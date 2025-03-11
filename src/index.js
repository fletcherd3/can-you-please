#! /usr/bin/env node

const { program } = require('commander');
const { version } = require('../package.json');
const { listFlows } = require('./commands/listFlows');
const { runFlow } = require('./commands/runFlow');
const { pullFlows } = require('./commands/pullFlows');

// Remove warning listeners
process.removeAllListeners('warning');

program
  .version(version)
  .description('A helpful assistant. Just ask nicely!')
  .hook('preAction', async (thisCommand) => {
    // Validate environment if required
    const cmd = thisCommand.args[0];
    if (cmd !== 'list-flows' && cmd !== 'pull-flows') {
      const env = thisCommand.opts().in;
      if (!env) {
        console.error('Error: option \'--in <env>\' argument missing');
        process.exit(1);
      }
    }
  });

program.command('list-flows').description('List all available flows').action(listFlows);

program.command('pull-flows').description('Update to latest version').action(pullFlows);

// Default command for running flows
program
  .argument('[flow-name]', 'Flow to run')
  .option('--in <env>', 'specify environment (dev or sand)')
  .option('--with <key=value...>', 'run flow with variables')
  .option('-d, --debug', 'print flow details to stdout')
  .option('--continue-on-error', 'continue executing requests even if one fails')
  .action(runFlow);

program.parse();
