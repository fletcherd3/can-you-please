const fs = require('fs');
const path = require('path');

const LOG_FILE_NAME = 'cyp.log';
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function getLogPath() {
  return path.join(REPO_ROOT, LOG_FILE_NAME);
}

function resetLog() {
  const logPath = getLogPath();
  fs.writeFileSync(logPath, '');
  return logPath;
}

function appendLog(content) {
  const logPath = getLogPath();
  fs.appendFileSync(logPath, content);
  return logPath;
}

module.exports = {
  LOG_FILE_NAME,
  appendLog,
  getLogPath,
  resetLog,
};
