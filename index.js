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
 * @param {string} gitSha the git sha representing the version of the service
 * @param {Options | "mock"} options configuration options, or the literal "mock" to use the mock backend
 *
 * @returns {beeline.Beeline}
 */
module.exports = function setup(name, gitSha, options) {
  /** @type {beeline.BeelineOpts} */
  const config = {
    serviceName: name,
    enabledInstrumentations: ['express', 'child_process'],
  };

  /** @param {{ data: Record<string, unknown>}} ev */
  function defaultPresendHook(ev) {
    ev.data.app_sha = gitSha;
    Object.entries(globalMetadata).forEach(([k, v]) => {
      ev.data[k] = v;
    });
  }

  const globalMetadata = {};
  if (options == 'mock') {
    config.impl = 'mock';
  } else {
    config.writeKey = options.APIKey;
    config.dataset = options.TracingDataset;
    config.sampleRate = options.DesiredSampleRate;
    config.presendHook = options.presendHook || defaultPresendHook;
    Object.assign(globalMetadata, options.GlobalMetadata);
    if (options.APIHost) {
      config.apiHost = options.APIHost;
    }
  }

  // Apply our custom instrumentation before configuring the beeline
  instrumentHTTP();

  return beeline(config);
};
