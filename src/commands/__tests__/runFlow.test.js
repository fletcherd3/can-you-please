jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('../../utils/newman', () => ({
  runNewman: jest.fn(),
}));

jest.mock('../../config/environments', () => ({
  getEnvironment: jest.fn(),
}));

jest.mock('../../config/globals', () => ({
  getDefaultGlobals: jest.fn(),
  mergeGlobals: jest.fn(),
}));

jest.mock('../../collection3/workspace', () => ({
  getCollection: jest.fn(),
}));

jest.mock('../../config/workspace', () => ({
  getWorkspaceDir: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  LOG_FILE_NAME: 'cyp.log',
  getLogPath: jest.fn(),
}));

const { runNewman } = require('../../utils/newman');
const fs = require('fs');
const { getEnvironment } = require('../../config/environments');
const { getDefaultGlobals, mergeGlobals } = require('../../config/globals');
const { getCollection } = require('../../collection3/workspace');
const { getWorkspaceDir } = require('../../config/workspace');
const { getLogPath } = require('../../utils/logger');
const { runFlow } = require('../runFlow');

describe('runFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('');
  });

  test('builds Newman config from Collection 3 data', async () => {
    const collection = { item: [{ name: 'create-user', item: [] }] };
    const environment = { values: [] };
    const globals = { values: [] };
    const workspaceDir = '/tmp/workspace';
    const logPath = '/tmp/cyp-repo/cyp.log';

    getWorkspaceDir.mockReturnValue(workspaceDir);
    getCollection.mockReturnValue(collection);
    getEnvironment.mockReturnValue(environment);
    getDefaultGlobals.mockReturnValue({ values: [] });
    mergeGlobals.mockReturnValue(globals);
    getLogPath.mockReturnValue(logPath);
    runNewman.mockResolvedValue();

    await runFlow('create-user', { in: 'dev', with: ['foo=bar'], debug: false });

    expect(getWorkspaceDir).toHaveBeenCalled();
    expect(getCollection).toHaveBeenCalled();
    expect(getEnvironment).toHaveBeenCalledWith('dev');
    expect(mergeGlobals).toHaveBeenCalledWith({ values: [] }, ['foo=bar']);
    expect(runNewman).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceDir,
        logPath,
        collection,
        environment,
        globals,
        folder: 'create-user',
      })
    );
  });

  test('prints the log path when the flow fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const workspaceDir = '/tmp/workspace';
    const logPath = '/tmp/cyp-repo/cyp.log';

    getWorkspaceDir.mockReturnValue(workspaceDir);
    getCollection.mockReturnValue({ item: [] });
    getEnvironment.mockReturnValue({ values: [] });
    getDefaultGlobals.mockReturnValue({ values: [] });
    mergeGlobals.mockReturnValue({ values: [] });
    getLogPath.mockReturnValue(logPath);
    runNewman.mockRejectedValue(new Error('Flow failed due to request error'));

    await runFlow('create-user', { in: 'dev', debug: false });

    expect(errorSpy).toHaveBeenCalledWith(
      '\nwomp womp :( an error occurred\n',
      'Flow failed due to request error'
    );
    expect(errorSpy).toHaveBeenCalledWith(`Log saved to: ${logPath}`);
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
