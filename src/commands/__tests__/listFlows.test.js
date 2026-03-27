jest.mock('../../collection3/workspace', () => ({
  getCollection: jest.fn(),
}));

const { getCollection } = require('../../collection3/workspace');
const { listFlows } = require('../listFlows');

describe('listFlows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('prints flows from Collection 3 metadata', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    getCollection.mockReturnValue({
      item: [
        { name: 'create-user', description: 'create a test user' },
        { name: 'get-otp', description: 'get otp' },
      ],
    });

    listFlows();

    expect(logSpy).toHaveBeenCalledWith(`    ${'Flow name'.padEnd(30)} Description`);
    expect(logSpy).toHaveBeenCalledWith(`   ${'create-user'.padEnd(30)} (create a test user)`);
    expect(logSpy).toHaveBeenCalledWith(`   ${'get-otp'.padEnd(30)} (get otp)`);

    logSpy.mockRestore();
  });

  test('prints a setup hint when no repo is configured', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    getCollection.mockImplementation(() => {
      throw new Error('No Collection 3 repo configured. Run `can-you-please setup`.');
    });

    listFlows();

    expect(errorSpy).toHaveBeenCalledWith(
      '\nwomp womp :( an error occurred\n',
      'No Collection 3 repo configured. Run `can-you-please setup`.'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
