function addOrReplaceVariable(json, variableMap) {
    const index = json.values.findIndex(item => item.key === variableMap.key);

    const variable = {
        key: variableMap.key,
        value: variableMap.value,
        type: "default",
        enabled: true
    };

    if (index !== -1) {
        json.values[index] = variable;
    } else {
        json.values.push(variable);
    }

    return json;
}

module.exports = {
    addOrReplaceVariable,
};