const os = require('os');
const { getDefaultGlobals, mergeGlobals, updateGlobalVariable } = require('../globals');

jest.mock('os');
jest.mock('../../postman/collection3', () => ({
  getGlobals: jest.fn(() => ({
    values: [{ key: 'product', value: 'zip-pay', type: 'default', enabled: true }],
  })),
}));

describe('globals', () => {
  describe('getDefaultGlobals', () => {
    beforeEach(() => {
      os.userInfo.mockReset();
    });

    test('should set default user variables when username exists', () => {
      os.userInfo.mockReturnValue({ username: 'testuser' });
      const globals = getDefaultGlobals();

      const firstName = globals.values.find((v) => v.key === 'first-name');
      const lastName = globals.values.find((v) => v.key === 'last-name');

      expect(firstName.value).toBe('testusers');
      expect(lastName.value).toBe('test-user');
      expect(globals.values).toHaveLength(3); // product + first-name + last-name
    });

    test('should not add user variables when username is invalid', () => {
      os.userInfo.mockReturnValue({ username: '123' });
      const globals = getDefaultGlobals();

      const firstName = globals.values.find((v) => v.key === 'first-name');
      const lastName = globals.values.find((v) => v.key === 'last-name');

      expect(firstName).toBeUndefined();
      expect(lastName).toBeUndefined();
      expect(globals.values).toHaveLength(1); // just product
      expect(globals.values[0].key).toBe('product');
    });
  });

  describe('mergeGlobals', () => {
    test('should merge new variables with base globals', () => {
      const baseGlobals = {
        values: [{ key: 'existing', value: 'value', type: 'default', enabled: true }],
      };
      const newVars = ['new=value'];

      const result = mergeGlobals(baseGlobals, newVars);

      expect(result.values).toHaveLength(2);
      expect(result.values[1]).toEqual({
        key: 'new',
        value: 'value',
        type: 'default',
        enabled: true,
      });
    });

    test('should update existing variables', () => {
      const baseGlobals = {
        values: [{ key: 'test', value: 'old', type: 'default', enabled: true }],
      };
      const newVars = ['test=new'];

      const result = mergeGlobals(baseGlobals, newVars);

      expect(result.values).toHaveLength(1);
      expect(result.values[0].value).toBe('new');
    });

    test('should throw error for invalid format', () => {
      const baseGlobals = { values: [] };
      const newVars = ['invalid'];

      expect(() => mergeGlobals(baseGlobals, newVars)).toThrow(
        'Variables should follow the format: --with key=value'
      );
    });
  });

  describe('updateGlobalVariable', () => {
    test('should update existing variable', () => {
      const globals = {
        values: [{ key: 'test', value: 'old', type: 'default', enabled: true }],
      };

      updateGlobalVariable(globals, 'test', 'new');

      expect(globals.values[0].value).toBe('new');
    });

    test('should add new variable', () => {
      const globals = { values: [] };

      updateGlobalVariable(globals, 'new', 'value');

      expect(globals.values[0]).toEqual({
        key: 'new',
        value: 'value',
        type: 'default',
        enabled: true,
      });
    });
  });
});
