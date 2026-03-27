#! /usr/bin/env node

const { program } = require('commander');
const { version } = require('../package.json');
const { listFlows } = require('./commands/listFlows');
const { runFlow } = require('./commands/runFlow');
const { pullFlows } = require('./commands/pullFlows');
const { setup } = require('./commands/setup');

// Remove warning listeners
process.removeAllListeners('warning');

program
  .version(version)
  .description('A helpful assistant for running Collection 3 flows. Just ask nicely!')
  .hook('preAction', async (thisCommand) => {
    // Validate environment if required
    const cmd = thisCommand.args[0];
    if (cmd !== 'list-flows' && cmd !== 'pull-flows' && cmd !== 'setup') {
      const env = thisCommand.opts().in;
      if (!env) {
        console.error('Error: option \'--in <env>\' argument missing');
        process.exit(1);
      }
    }
  });

program.command('list-flows').description('List all available flows').action(listFlows);
program.command('setup').description('Configure your Collection 3 workspace directory').action(setup);

program.command('pull-flows').description('Update to latest version').action(pullFlows);

// Default command for running flows
program
  .argument('[flow-name]', 'Flow to run')
  .option('--in <env>', 'specify environment (dev or sand)')
  .option('--with <key=value...>', 'run flow with variables')
  .option('-d, --debug', 'print flow details to stdout')
  .option('-l, --log-file', 'create a log file in the current directory')
  .option('--continue-on-error', 'continue executing requests even if one fails')
  .action(runFlow);

program.parse();
