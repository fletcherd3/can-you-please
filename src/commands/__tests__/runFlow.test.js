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

jest.mock('../../postman/collection3', () => ({
  getCollection: jest.fn(),
}));

const { runNewman } = require('../../utils/newman');
const { getEnvironment } = require('../../config/environments');
const { getDefaultGlobals, mergeGlobals } = require('../../config/globals');
const { getCollection } = require('../../postman/collection3');
const { runFlow } = require('../runFlow');

describe('runFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('builds Newman config from Collection 3 data', async () => {
    const collection = { item: [{ name: 'create-user', item: [] }] };
    const environment = { values: [] };
    const globals = { values: [] };

    getCollection.mockReturnValue(collection);
    getEnvironment.mockReturnValue(environment);
    getDefaultGlobals.mockReturnValue({ values: [] });
    mergeGlobals.mockReturnValue(globals);
    runNewman.mockResolvedValue();

    await runFlow('create-user', { in: 'dev', with: ['foo=bar'], debug: false });

    expect(getCollection).toHaveBeenCalled();
    expect(getEnvironment).toHaveBeenCalledWith('dev');
    expect(mergeGlobals).toHaveBeenCalledWith({ values: [] }, ['foo=bar']);
    expect(runNewman).toHaveBeenCalledWith(
      expect.objectContaining({
        collection,
        environment,
        globals,
        folder: 'create-user',
      })
    );
  });
});
