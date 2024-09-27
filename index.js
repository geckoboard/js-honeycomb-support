const beeline = require('honeycomb-beeline');

const instrumentHTTP = require('./instrumentation/http');

/**
 * @typedef {object} Options
 * @property {string} APIKey
 * @property {string | undefined} APIHost
 * @property {string} TracingDataset
 * @property {number} DesiredSampleRate
 * @property {Record<string, unknown> | undefined} GlobalMetadata
 * @property {(ev: { data: Record<string, unknown> }) => void | undefined} [presendHook]
 */

/**
 * Configure honeycomb with our standard preferences
 * @param {string} name the name of the service
 * @param {string | "http"} process the type of process (e.g. "http" or "worker")
 * @param {string} gitSha the git sha representing the version of the service
 * @param {Options | "mock"} options configuration options, or the literal "mock" to use the mock backend
 *
 * @returns {beeline.Beeline}
 */
module.exports = function setup(name, gitSha, options, process = 'http') {
  /** @type {beeline.BeelineOpts} */
  const config = {
    serviceName: name,
    enabledInstrumentations: ['express', 'child_process'],
  };

  const globalMetadata = {};
  if (options == 'mock') {
    config.impl = 'mock';
  } else {
    // config.WriteKey must be set to a non-empty value, but when we use Refinery to aggregate all of our events
    // and send them using its own WriteKey, we don't need to specify app-specific WriteKeys.
    // The `beeline-go` package sets a default WriteKey (which is invalid as far as Honeycomb goes)
    // to allow the tracing library to be initialized.
    // https://github.com/honeycombio/beeline-go/blob/56c4f55d6efec3d417ba32748718fefd2e362a0f/beeline.go#L22
    const defaultWriteKey = 'apikey-placeholder';

    config.writeKey = options.APIKey || defaultWriteKey;
    config.dataset = options.TracingDataset;
    config.sampleRate = options.DesiredSampleRate;
    /** @param {{ data: Record<string, unknown>}} ev */
    config.presendHook = ev => {
      ev.data.app_sha = gitSha;
      ev.data['service.process'] = process;
      Object.entries(globalMetadata).forEach(([k, v]) => {
        ev.data[k] = v;
      });
      if (options.presendHook) {
        options.presendHook(ev);
      }
    };
    Object.assign(globalMetadata, options.GlobalMetadata);
    if (options.APIHost) {
      config.apiHost = options.APIHost;
    }
  }

  // Apply our custom instrumentation before configuring the beeline
  instrumentHTTP();

  return beeline(config);
};
