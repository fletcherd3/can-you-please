const { runNewman } = require('../utils/newman');
const { getEnvironment } = require('../config/environments');
const { getDefaultGlobals, mergeGlobals } = require('../config/globals');
const { getCollection } = require('../postman/collection3');

async function runFlow(flowName, options) {
  try {
    const environment = getEnvironment(options.in);
    const baseGlobals = getDefaultGlobals();
    const globals = mergeGlobals(baseGlobals, options.with);
    const collection = getCollection();

    const config = {
      collection,
      environment,
      globals,
      folder: flowName,
      reporters: options.logFile ? ['json'] : [],
      reporter: options.debug
        ? {
          cli: {
            silent: true,
            noSummary: true,
            noBanner: true,
          },
        }
        : undefined,
      abortOnError: !options.continueOnError,
    };

    await runNewman(config);
  } catch (error) {
    console.error('\nwomp womp :( an error occurred\n', error.message);
    process.exit(1);
  }
}

module.exports = { runFlow };
