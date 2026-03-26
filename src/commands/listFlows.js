const { getCollection } = require('../postman/collection3');

function listFlows() {
  const collection = getCollection();
  console.log(`    ${'Flow name'.padEnd(30)} Description`);
  collection.item.forEach((flow) => {
    console.log(`   ${flow.name.padEnd(30)} (${flow.description})`);
  });
}

module.exports = { listFlows };
