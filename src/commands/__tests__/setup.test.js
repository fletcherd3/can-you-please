jest.mock('readline/promises', () => ({
  createInterface: jest.fn(),
}));

jest.mock('../../config/workspace', () => ({
  saveWorkspaceDir: jest.fn(),
}));

const readline = require('readline/promises');
const { saveWorkspaceDir } = require('../../config/workspace');
const { setup } = require('../setup');

describe('setup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('prompts for and saves the workspace directory', async () => {
    const question = jest.fn().mockResolvedValue('/tmp/demo-workspace');
    const close = jest.fn();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    readline.createInterface.mockReturnValue({ question, close });
    saveWorkspaceDir.mockReturnValue('/tmp/demo-workspace');

    await setup();

    expect(question).toHaveBeenCalled();
    expect(saveWorkspaceDir).toHaveBeenCalledWith('/tmp/demo-workspace');
    expect(logSpy).toHaveBeenCalledWith('Saved Collection 3 workspace: /tmp/demo-workspace');

    logSpy.mockRestore();
  });
});
