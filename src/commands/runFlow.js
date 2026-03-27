const fs = require('fs');
const path = require('path');
const { runNewman } = require('../utils/newman');
const { getEnvironment } = require('../config/environments');
const { getDefaultGlobals, mergeGlobals } = require('../config/globals');
const { getCollection } = require('../collection3/workspace');
const { LOG_FILE_NAME, getLogPath } = require('../utils/logger');
const { getWorkspaceDir } = require('../config/workspace');

async function runFlow(flowName, options) {
  try {
    const workspaceDir = getWorkspaceDir();
    const environment = getEnvironment(options.in);
    const baseGlobals = getDefaultGlobals();
    const globals = mergeGlobals(baseGlobals, options.with);
    const collection = getCollection();
    const logPath = getLogPath();
    const gitIgnorePath = path.join(path.dirname(logPath), '.gitignore');
    const currentGitIgnore = fs.existsSync(gitIgnorePath)
      ? fs.readFileSync(gitIgnorePath, 'utf8')
      : '';
    const gitIgnoreEntries = currentGitIgnore.split(/\r?\n/).map((line) => line.trim());

    if (!gitIgnoreEntries.includes(LOG_FILE_NAME)) {
      const suffix = currentGitIgnore.length > 0 && !currentGitIgnore.endsWith('\n') ? '\n' : '';
      fs.writeFileSync(gitIgnorePath, `${currentGitIgnore}${suffix}${LOG_FILE_NAME}\n`);
    }

    const config = {
      workspaceDir,
      logPath,
      collection,
      environment,
      globals,
      folder: flowName,
      reporter: options.debug
        ? {
          cli: {
            silent: true,
            noSummary: true,
            noBanner: true,
          },
        }
        : undefined,
      abortOnError: !options.continueOnError,
    };

    await runNewman(config);
  } catch (error) {
    const logPath = error.logPath || (() => {
      try {
        return getLogPath();
      } catch {
        return null;
      }
    })();

    console.error('\nwomp womp :( an error occurred\n', error.message);
    if (logPath) {
      console.error(`Log saved to: ${logPath}`);
    }
    process.exit(1);
  }
}

module.exports = { runFlow };
