/**
 * Cribbed from https://github.com/honeycombio/beeline-nodejs/blob/2334c7fadfbb701c3e8f8b9a3a5a509fb648ea9d/lib/instrumentation/http.js
 * and then modified to match the naming scheme from beeline-go
 *
 * mostly changed beyond recognition now, as we can simplify the code
 * significantly by only supporting newer versions of node - which expose
 * more properties on the HTTP request object
 *
 * Intended to be used instead of the default automatic instrumentation
 */
const http = require('http');
const https = require('https');
const url = require('url');
const shimmer = require('shimmer');
const beeline = require('honeycomb-beeline');

const ignoredResponseHeaders = new Set([
  'access-control-allow-credentials',
  'access-control-allow-origin',
  'access-control-expose-headers',
  'cache-control',
  'set-cookie',
  'x-content-type-options',
  'x-frame-options',
  'x-newrelic-app-data',
]);

/**
 * @param {http.IncomingHttpHeaders} headers
 * @returns {Record<string, unknown>}
 */
function responseHeaderFields(headers) {
  /**
   * @type {Record<string, unknown>}
   */
  const fields = {};
  Object.keys(headers).forEach(header => {
    const clean = header.toLowerCase();
    if (ignoredResponseHeaders.has(clean)) return;
    fields[`response.header.${clean}`] = headers[header];
  });
  return fields;
}

const wrapped = Symbol('geckoboard-honeycomb-http');
/**
 * @param {{[k: keyof any]: unknown}} mod
 * @returns {boolean}
 */
function alreadyWrapped(mod) {
  if (mod[wrapped]) {
    return true;
  }
  mod[wrapped] = true;
  return false;
}

/**
 * @template {typeof http | typeof https} Module
 * @param {Module} mod
 */
function instrumentHTTP(mod) {
  // Avoid double-wrapping in case instrumentation is applied multiple times
  if (alreadyWrapped(mod)) {
    return;
  }

  shimmer.wrap(mod, 'get', _original => {
    // we have to replace http.get since it references request through
    // a closure (so we can't replace the value it uses..)
    // @ts-ignore - typescript isn't convinced we're just delegating
    return (_url, options, cb) => {
      const req = mod.request.call(mod, _url, options, cb);
      req.end();
      return req;
    };
  });

  shimmer.wrap(mod, 'request', original => {
    // @ts-ignore - typescript isn't convinced we're just delegating
    return (_url, options, cb) => {
      if (!beeline.traceActive()) {
        return original.call(mod, _url, options, cb);
      }

      return beeline.startAsyncSpan(
        {
          name: 'http_client',
          'meta.type': 'http_client',
        },
        span => {
          const req = original.call(mod, _url, options, cb);
          // TODO: respect configured custom propagation hooks
          req.setHeader(
            beeline.honeycomb.TRACE_HTTP_HEADER,
            beeline.honeycomb.marshalTraceContext(beeline.getTraceContext()),
          );
          // TODO: technically we could lose the port here if the caller sets
          // {setHost: false}, but that's fairly niche so lets ignore it for now
          const host = req.getHeader('Host') || req.host;
          const u = new url.URL(`${req.protocol}//${host}${req.path}`);
          span.addContext({
            'request.method': req.method,
            'request.path': u.pathname,
            'request.query': u.search,
            'request.host': u.hostname,
            'request.url': u.href,
            'request.scheme': u.protocol.slice(0, -1),
          });
          req.once('response', res => {
            let responseBody = '';
            res.on('data', chunk => {
              responseBody += chunk;
            });

            res.on('end', () => {
              /** @type {Object.<string, any>} */
              const context = {
                'response.http_version': res.httpVersion,
                'response.status_code': res.statusCode,
                ...responseHeaderFields(res.headers),
              };

              if (res.statusCode && res.statusCode >= 400) {
                context['response.body'] = responseBody;
              }

              span.addContext(context);
              beeline.finishSpan(span, 'request');
            });
          });
          return req;
        },
      );
    };
  });
}

module.exports = function instrument() {
  instrumentHTTP(http);
  instrumentHTTP(https);
};
