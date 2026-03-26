jest.mock('../../postman/collection3', () => ({
  getCollection: jest.fn(),
}));

const { getCollection } = require('../../postman/collection3');
const { listFlows } = require('../listFlows');

describe('listFlows', () => {
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
});
