const environmentDev = require('../flows/environments/cyp_dev.postman_environment.json');
const environmentSand = require('../flows/environments/cyp_sand.postman_environment.json');

function getEnvironment(env) {
  switch (env) {
  case 'dev':
    return environmentDev;
  case 'sand':
    return environmentSand;
  default:
    throw new Error(`Invalid environment: ${env}. Use 'dev' or 'sand'`);
  }
}

module.exports = { getEnvironment };
