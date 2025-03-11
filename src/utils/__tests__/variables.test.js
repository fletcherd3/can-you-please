const { parseVariables } = require('../variables');

describe('parseVariables', () => {
  test('should parse key-value pairs correctly', () => {
    const input = ['name=John', 'age=25'];
    const result = parseVariables(input);

    expect(result).toEqual({
      values: [
        { key: 'name', value: 'John', type: 'default', enabled: true },
        { key: 'age', value: '25', type: 'default', enabled: true },
      ],
    });
  });

  test('should throw error for invalid format', () => {
    const input = ['invalid'];
    expect(() => parseVariables(input)).toThrow(
      'Variables should follow the format: --with key=value'
    );
  });

  test('should convert keys to lowercase', () => {
    const input = ['NAME=John'];
    const result = parseVariables(input);

    expect(result.values[0].key).toBe('name');
  });
});
