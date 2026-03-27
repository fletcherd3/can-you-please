const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');
const { saveWorkspaceDir } = require('../config/workspace');

async function setup() {
  const rl = readline.createInterface({ input, output });

  try {
    const answer = await rl.question(
      'Where is your Postman Collection 3 repo? (the repo containing `postman/collections`) '
    );
    const savedPath = saveWorkspaceDir(answer.trim());

    console.log(`Saved Collection 3 repo: ${savedPath}`);
    console.log('You can now run `can-you-please list-flows` and your existing flow commands.');
  } catch (error) {
    console.error('\nwomp womp :( setup failed\n', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

module.exports = { setup };
