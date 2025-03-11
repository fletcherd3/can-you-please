const collection = require('../flows/collections/cyp.postman_collection.json');

function listFlows() {
  console.log(`    ${'Flow name'.padEnd(30)} Description`);
  collection.item.forEach((flow) => {
    console.log(`   ${flow.name.padEnd(30)} (${flow.description})`);
  });
}

module.exports = { listFlows };
