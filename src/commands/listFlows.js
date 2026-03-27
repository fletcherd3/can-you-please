const { getCollection } = require('../collection3/workspace');

function listFlows() {
  try {
    const collection = getCollection();
    console.log(`    ${'Flow name'.padEnd(30)} Description`);
    collection.item.forEach((flow) => {
      console.log(`   ${flow.name.padEnd(30)} (${flow.description})`);
    });
  } catch (error) {
    console.error('\nwomp womp :( an error occurred\n', error.message);
    process.exit(1);
  }
}

module.exports = { listFlows };
