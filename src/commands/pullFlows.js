const { execSync } = require('child_process');

function pullFlows() {
  console.log('Updating to latest version...');
  execSync('npm update -g @zip/can-you-please --no-fund');
  console.log('Update complete!');
}

module.exports = { pullFlows };
