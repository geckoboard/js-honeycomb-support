/* eslint-env jest */
const http = require('http');
const jsonBody = require('body/json');

const setup = require('./');

/** @type {http.Server} */
let server;
/** @type {string} */
let address;
/**
 * @type {(call: {
 *   path: string,
 *   headers: http.IncomingHttpHeaders,
 *   body: unknown
 * }) => void}
 */
let resolveCall;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    jsonBody(req, res, (err, body) => {
      if (err) {
        res.writeHead(500);
        res.write(JSON.stringify([{ error: err }]));
      } else {
        resolveCall({ path: req.url || '', headers: req.headers, body });
        res.write(JSON.stringify([{ status: 'ok' }]));
      }
      res.end();
    });
  });
  await new Promise(done => server.listen(0, 'localhost', () => done(0)));
  const addr = server.address();
  if (addr && typeof addr == 'object') {
    address = 'http://localhost:' + addr.port;
  }
});

afterAll(() => {
  server.close();
});

it('configures honeycomb for sending events', async () => {
  const beeline = setup('testing', 'http', 'beefdad', {
    APIHost: address,
    APIKey: 'keystuff',
    GlobalMetadata: {
      global: 'fields',
    },
    DesiredSampleRate: 1,
    TracingDataset: 'testing.traces',
  });

  const callP = new Promise(resolve => {
    resolveCall = resolve;
  });

  const trace = beeline.startTrace({ field: 'value' }, 'trace1', 'parent1');
  if (trace) beeline.finishTrace(trace);

  const call = await callP;

  expect(call.path).toMatch(/\/testing\.traces$/);
  expect(call.headers).toHaveProperty('x-honeycomb-team', 'keystuff');
  expect(call.body).toMatchObject([
    {
      samplerate: 1,
      data: {
        'trace.trace_id': 'trace1',
        'trace.parent_id': 'parent1',
        service_name: 'testing',
        'service.process': 'http',
        app_sha: 'beefdad',
        global: 'fields',
      },
    },
  ]);
});
