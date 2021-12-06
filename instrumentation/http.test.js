/* eslint-env node, jest */
const net = require('net');
const http = require('http');
const https = require('https');
const selfsigned = require('selfsigned');
const tracker = require('honeycomb-beeline/lib/async_tracker');

function newMockContext() {
  return { id: 0, spanId: 50000, stack: [] };
}

// Setup honeycomb in mock-mode
const beeline = require('../index')('tests', '?', 'mock');
// Ensure there's a root trace for spans to be attached to
// we won't bother trying to end this trace, it wouldn't go anywhere anyway
beeline.startTrace({ name: 'test suite' });
// and clear it's events before every test
beforeEach(() => {
  beeline._apiForTesting().sentEvents = [];
});

require('./http')();

let server, port;

// Can be used as an option to http.request to force connections onto the test server
function createConnection() {
  return net.createConnection({ host: 'localhost', port });
}

function handler(req, res) {
  const trace = beeline.honeycomb.TRACE_HTTP_HEADER.toLowerCase();
  res.setHeader('received-trace-header', req.headers[trace] || 'MISSING!');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Content-Length', '2');
  res.setHeader('X-Frame-Options', 'DENY');
  res.write('ok');
  res.end();
}

beforeAll(async () => {
  server = http.createServer(handler);
  port = await new Promise(resolve => {
    server.listen(0, 'localhost', () => {
      resolve(server.address().port);
    });
  });
});

afterAll(() => {
  server.close();
});

describe('argument permutations', () => {
  test('(options)', async () => {
    await new Promise(resolve => {
      http.get({ hostname: 'localhost', port }).on('close', resolve);
    });

    expect(beeline._apiForTesting().sentEvents).toMatchObject([
      {
        name: 'http_client',
        'meta.type': 'http_client',
        'request.scheme': 'http',
        'request.method': `GET`,
        'request.path': `/`,
        'request.host': `localhost`,
        'request.url': `http://localhost:${port}/`,
      },
    ]);
  });

  test('(options, callback)', async () => {
    await new Promise(resolve => {
      http.get({ hostname: 'localhost', port }, resolve);
    });

    expect(beeline._apiForTesting().sentEvents).toMatchObject([
      {
        name: 'http_client',
        'meta.type': 'http_client',
        'request.method': `GET`,
        'request.path': `/`,
        'request.host': `localhost`,
        'request.url': `http://localhost:${port}/`,
      },
    ]);
  });

  test('(url-string)', async () => {
    await new Promise(resolve => {
      http.get(`http://localhost:${port}`).on('close', resolve);
    });
    expect(beeline._apiForTesting().sentEvents).toMatchObject([
      {
        name: 'http_client',
        'meta.type': 'http_client',
        'request.url': `http://localhost:${port}/`,
      },
    ]);
  });

  test('(url-string, options)', async () => {
    tracker.setTracked(newMockContext());

    await new Promise(resolve => {
      http
        .get('http://what.not:8888', { createConnection })
        .on('close', resolve);
    });

    expect(beeline._apiForTesting().sentEvents).toMatchObject([
      {
        name: 'http_client',
        'meta.type': 'http_client',
        'request.url': 'http://what.not:8888/',
      },
    ]);
  });

  test('(url-string, callback)', async () => {
    tracker.setTracked(newMockContext());

    await new Promise(resolve => {
      http.get(`http://localhost:${port}`, resolve);
    });

    expect(beeline._apiForTesting().sentEvents).toMatchObject([
      {
        name: 'http_client',
        'meta.type': 'http_client',
        'request.url': `http://localhost:${port}/`,
      },
    ]);
  });

  test('(url-string, options, callback)', async () => {
    tracker.setTracked(newMockContext());

    await new Promise(resolve => {
      http
        .request(
          'http://what.not:9999/upload',
          {
            method: 'POST',
            headers: {
              'content-type': 'text/plain',
              'content-length': 4,
            },
            createConnection,
          },
          resolve,
        )
        .write('body');
    });
    expect(beeline._apiForTesting().sentEvents).toMatchObject([
      {
        name: 'http_client',
        'meta.type': 'http_client',
        'request.method': `POST`,
        'request.path': `/upload`,
        'request.host': `what.not`,
        'request.url': `http://what.not:9999/upload`,
      },
    ]);
  });

  test('(url-URL)', async () => {
    tracker.setTracked(newMockContext());

    await new Promise(resolve => {
      http.get(new URL(`http://localhost:${port}`)).on('close', resolve);
    });
    expect(beeline._apiForTesting().sentEvents).toMatchObject([
      {
        name: 'http_client',
        'request.url': `http://localhost:${port}/`,
      },
    ]);
  });

  test('(url-URL, options)', async () => {
    tracker.setTracked(newMockContext());

    await new Promise(resolve => {
      http
        .get(new URL('http://what.not:9999'), { createConnection })
        .on('close', resolve);
    });

    expect(beeline._apiForTesting().sentEvents).toMatchObject([
      {
        name: 'http_client',
        'meta.type': 'http_client',
        'request.method': `GET`,
        'request.path': `/`,
        'request.host': `what.not`,
        'request.url': `http://what.not:9999/`,
      },
    ]);
  });

  test('(url-URL, callback)', async () => {
    tracker.setTracked(newMockContext());

    await new Promise(resolve => {
      http.get(new URL(`http://localhost:${port}`), resolve);
    });

    expect(beeline._apiForTesting().sentEvents).toMatchObject([
      {
        name: 'http_client',
        'meta.type': 'http_client',
        'request.method': `GET`,
        'request.path': `/`,
        'request.host': `localhost`,
        'request.url': `http://localhost:${port}/`,
      },
    ]);
  });

  test('(url-URL, options, callback)', async () => {
    tracker.setTracked(newMockContext());

    await new Promise(resolve => {
      http.get(
        new URL('http://what.not:9999/some/path'),
        { createConnection },
        resolve,
      );
    });
    expect(beeline._apiForTesting().sentEvents).toMatchObject([
      {
        name: 'http_client',
        'meta.type': 'http_client',
        'request.method': `GET`,
        'request.path': `/some/path`,
        'request.host': `what.not`,
        'request.url': `http://what.not:9999/some/path`,
      },
    ]);
  });
});

test('url as a string', async () => {
  tracker.setTracked(newMockContext());

  const res = await new Promise(resolve => {
    http.get(`http://localhost:${port}/blah/blah`, resolve);
  });
  expect(res.headers).toHaveProperty(
    'received-trace-header',
    '1;trace_id=0,parent_id=51001,context=e30=',
  );
  expect(beeline._apiForTesting().sentEvents).toMatchObject([
    {
      name: 'http_client',
      'meta.type': 'http_client',
      'request.method': `GET`,
      'request.path': `/blah/blah`,
      'request.host': `localhost`,
      'request.url': `http://localhost:${port}/blah/blah`,
    },
  ]);
});

test('url as options', async () => {
  tracker.setTracked(newMockContext());

  const res = await new Promise(resolve => {
    http.get({ hostname: 'localhost', port }, resolve);
  });
  expect(res.headers).toHaveProperty(
    'received-trace-header',
    '1;trace_id=0,parent_id=51001,context=e30=',
  );
  expect(beeline._apiForTesting().sentEvents).toMatchObject([
    {
      name: 'http_client',
      'meta.type': 'http_client',
      'request.method': `GET`,
      'request.path': `/`,
      'request.host': `localhost`,
      'request.url': `http://localhost:${port}/`,
    },
  ]);
});

test('url as options with pathname and query', async () => {
  tracker.setTracked(newMockContext());

  const res = await new Promise(resolve => {
    http.get(
      {
        hostname: 'localhost',
        port,
        path: '/test?something=true',
        pathname: '/test',
        search: '?something=true',
      },
      resolve,
    );
  });
  expect(res.headers).toHaveProperty(
    'received-trace-header',
    '1;trace_id=0,parent_id=51001,context=e30=',
  );
  expect(beeline._apiForTesting().sentEvents).toMatchObject([
    {
      name: 'http_client',
      'meta.type': 'http_client',
      'request.method': `GET`,
      'request.path': `/test`,
      'request.host': `localhost`,
      'request.url': `http://localhost:${port}/test?something=true`,
      'request.query': '?something=true',
    },
  ]);
});

test('correct response context', async () => {
  tracker.setTracked(newMockContext());

  const res = await new Promise(resolve => {
    http.get(`http://localhost:${port}`, resolve);
  });
  expect(res.headers).toHaveProperty(
    'received-trace-header',
    '1;trace_id=0,parent_id=51001,context=e30=',
  );
  expect(beeline._apiForTesting().sentEvents).toMatchObject([
    {
      'meta.type': 'http_client',
      'response.http_version': res.httpVersion,
      'response.status_code': res.statusCode,
      'response.header.content-length': res.headers['content-length'],
      'response.header.content-type': res.headers['content-type'],
      'response.header.content-encoding': res.headers['content-encoding'],
    },
  ]);
  const event = beeline._apiForTesting().sentEvents[0];
  expect(event['response.header.x-frame-options']).toBeUndefined();
});

test('url + options', async () => {
  tracker.setTracked(newMockContext());

  const res = await new Promise(resolve => {
    http.get('http://localhost:80', { hostname: 'localhost', port }, resolve);
  });

  expect(res.headers).toHaveProperty(
    'received-trace-header',
    '1;trace_id=0,parent_id=51001,context=e30=',
  );
  expect(beeline._apiForTesting().sentEvents).toMatchObject([
    {
      name: 'http_client',
      'meta.type': 'http_client',
      'request.method': `GET`,
      'request.path': `/`,
      'request.host': `localhost`,
      'request.url': `http://localhost:${port}/`,
    },
  ]);
});

test('url + options, without active trace', async () => {
  tracker.setTracked(null);

  const res = await new Promise(resolve => {
    http.get('http://localhost:80', { hostname: 'localhost', port }, resolve);
  });
  expect(res.headers).toHaveProperty('received-trace-header', 'MISSING!');
  expect(beeline._apiForTesting().sentEvents).toEqual([]);
});

describe('https', () => {
  let tlsServer, tlsPort;
  beforeAll(async () => {
    const { private: key, cert } = selfsigned.generate(null, { days: 1 });
    tlsServer = https.createServer({ key, cert }, handler);
    await new Promise(resolve => tlsServer.listen(0, 'localhost', resolve));
    tlsPort = tlsServer.address().port;
  });
  afterAll(() => {
    tlsServer.close();
  });

  test('gets instrumented too', async () => {
    tracker.setTracked(newMockContext());

    const res = await new Promise(resolve =>
      https.get(
        `https://localhost:${tlsPort}`,
        { rejectUnauthorized: false },
        resolve,
      ),
    );

    expect(res.headers).toHaveProperty(
      'received-trace-header',
      '1;trace_id=0,parent_id=51001,context=e30=',
    );
    expect(beeline._apiForTesting().sentEvents).toMatchObject([
      {
        name: 'http_client',
        'meta.type': 'http_client',
        'request.scheme': 'https',
        'request.method': `GET`,
        'request.path': `/`,
        'request.host': `localhost`,
        'request.url': `https://localhost:${tlsPort}/`,
      },
    ]);
  });
});
