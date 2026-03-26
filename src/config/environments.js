const { getEnvironmentByName } = require('../postman/collection3');

function getEnvironment(env) {
  return getEnvironmentByName(env);
}

module.exports = { getEnvironment };
