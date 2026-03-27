const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  LOG_FILE_NAME,
  appendLog,
  getLogPath,
  resetLog,
} = require('../logger');

describe('logger', () => {
  test('getLogPath resolves cyp.log in the can-you-please repo root', () => {
    expect(getLogPath()).toBe(path.resolve(__dirname, '../../../cyp.log'));
  });

  test('resetLog replaces the previous log contents', () => {
    const logPath = path.resolve(__dirname, `../../../${LOG_FILE_NAME}`);
    const originalExists = fs.existsSync(logPath);
    const original = originalExists ? fs.readFileSync(logPath, 'utf8') : null;

    try {
      fs.writeFileSync(logPath, 'old data');
      resetLog();
      appendLog('new data');

      expect(fs.readFileSync(logPath, 'utf8')).toBe('new data');
    } finally {
      if (originalExists) {
        fs.writeFileSync(logPath, original);
      } else if (fs.existsSync(logPath)) {
        fs.unlinkSync(logPath);
      }
    }
  });
});
