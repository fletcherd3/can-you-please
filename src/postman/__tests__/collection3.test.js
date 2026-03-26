const {
  buildFlow,
  buildRequest,
  getCollection,
  getEnvironmentByName,
  getGlobals,
} = require('../collection3');

describe('Collection 3 loader', () => {
  test('buildRequest converts Collection 3 request YAML into a Newman-compatible request', () => {
    const request = buildRequest(
      'src/postman/collections/cyp/create-user/creating user.request.yaml'
    );

    expect(request.name).toBe('creating user');
    expect(request.request.method).toBe('POST');
    expect(request.request.header).toEqual(
      expect.arrayContaining([{ key: 'Content-Type', value: 'application/json' }])
    );
    expect(request.request.body).toMatchObject({
      mode: 'raw',
      options: { raw: { language: 'json' } },
    });
    expect(request.event).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          listen: 'test',
        }),
      ])
    );
  });

  test('buildFlow uses Collection 3 metadata and request order', () => {
    const flow = buildFlow('src/postman/collections/cyp/test-flow');

    expect(flow.name).toBe('test-flow');
    expect(flow.description).toBe('test flow');
    expect(flow.item.map((request) => request.name)).toEqual([
      'request-1',
      'request-2',
      'request-3',
    ]);
  });

  test('getCollection returns flows ordered by Collection 3 definition order', () => {
    const collection = getCollection();

    expect(collection.info.name).toBe('cyp');
    expect(collection.item.map((flow) => flow.name)).toEqual([
      'create-user',
      'create-user-with-card',
      'get-otp',
      'test-flow',
      'test-error-flow',
    ]);
  });

  test('getEnvironmentByName normalizes Collection 3 environment files', () => {
    const environment = getEnvironmentByName('dev');

    expect(environment.name).toBe('cyp_dev');
    expect(environment.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'e_short_env',
          value: 'dev',
          type: 'default',
          enabled: true,
        }),
      ])
    );
  });

  test('getGlobals normalizes Collection 3 globals files', () => {
    const globals = getGlobals();

    expect(globals.name).toBe('Globals');
    expect(globals.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'product',
          value: 'zip-pay',
          type: 'default',
          enabled: true,
        }),
      ])
    );
  });
});
