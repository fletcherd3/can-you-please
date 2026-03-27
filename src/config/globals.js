const os = require('os');
const { getGlobals } = require('../collection3/workspace');

function getDefaultGlobals() {
  const globals = JSON.parse(JSON.stringify(getGlobals())); // Deep clone
  const username = os.userInfo().username;
  const defaultFirstName = username ? username.replace(/[^a-zA-Z]/g, '') : '';

  if (defaultFirstName && defaultFirstName.length > 0) {
    updateGlobalVariable(globals, 'first-name', defaultFirstName + 's');
    updateGlobalVariable(globals, 'last-name', 'test-user');
  }

  return globals;
}

function updateGlobalVariable(globals, key, value) {
  const index = globals.values.findIndex((item) => item.key === key);
  const variable = {
    key,
    value,
    type: 'default',
    enabled: true,
  };

  if (index !== -1) {
    globals.values[index] = variable;
  } else {
    globals.values.push(variable);
  }
}

function mergeGlobals(baseGlobals, newVariables) {
  const globals = JSON.parse(JSON.stringify(baseGlobals)); // Deep clone

  if (!newVariables) return globals;

  for (const pair of newVariables) {
    const [key, value] = pair.replace(/\s/g, '').split('=');
    if (!key || !value) {
      throw new Error('Variables should follow the format: --with key=value');
    }
    updateGlobalVariable(globals, key.toLowerCase(), value);
  }

  return globals;
}

module.exports = {
  getDefaultGlobals,
  mergeGlobals,
  updateGlobalVariable,
};
