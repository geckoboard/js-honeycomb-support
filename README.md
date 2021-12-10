# js-honeycomb-support

Helpful stuff for adding honeycomb to a nodejs app

- Provides a wrapper for initializing honeycomb from our usual config format
  with standard fields added to every event
- Replaces the default http instrumentation with a custom variant which uses the
  same naming as the Go beeline

## Usage

Add to your project's dependencies
```sh
yarn add geckoboard/js-honeycomb-support#main
```

Import and run setup early in the application's startup
```js
// ES Modules-style
import setup from 'honeycomb-support'
// or CommonJS
const setup = require('honeycomb-support');

// And then call setup to init
setup(
  'my-app',
  gitSha,
  config.HoneycombConfig,
);
```

Elsewhere in the application you can require the beeline from honeycomb

```js
// ES Modules-style
import beeline from 'honeycomb-beeline';
// or CommonJS
const beeline = require('honeycomb-beeline');
```

## Usage in tests

Setup also has a test mode, which can be used to store events in memory and
then assert on what would have been sent to honeycomb

```js
// init in mock mode
setup('testsuite', 'no-version', 'mock');

// Ensure there's a root trace for spans to be attached to
// we won't bother trying to end this trace, it wouldn't go anywhere anyway
beeline.startTrace({ name: 'test suite' });

// Clear the in-memory events between each test
beforeEach(() => {
  beeline._apiForTesting().sentEvents = [];
});

// And then in you tests you can assert on the content of events
expect(beeline._apiForTesting().sentEvents).toMatchObject([
  {
    name: 'roadie/grpcCall',
    'grpc.service': 'roadie',
    'grpc.arg.0': 'dash_123',
    'grpc.arg.1': 'randomArg',
    'meta.type': 'grpc_client',
  },
]);
```
