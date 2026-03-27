const { getEnvironmentByName } = require('../collection3/workspace');

function getEnvironment(env) {
  return getEnvironmentByName(env);
}

module.exports = { getEnvironment };
