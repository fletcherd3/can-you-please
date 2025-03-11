function parseVariables(keyValuePairs) {
  const variables = {
    values: [],
  };

  for (const pair of keyValuePairs) {
    const [key, value] = pair.replace(/\s/g, '').split('=');

    if (!key || !value) {
      throw new Error('Variables should follow the format: --with key=value');
    }

    variables.values.push({
      key: key.toLowerCase(),
      value,
      type: 'default',
      enabled: true,
    });
  }

  return variables;
}

module.exports = { parseVariables };
