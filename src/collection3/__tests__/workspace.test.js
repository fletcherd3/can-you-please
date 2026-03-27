const path = require('path');
const {
  buildFlow,
  buildRequest,
  getCollection,
  getEnvironmentByName,
  getGlobals,
} = require('../workspace');

const fixtureWorkspaceDir = path.resolve(__dirname, '../../../test/fixtures/workspace');

describe('Collection 3 workspace loader', () => {
  test('buildRequest converts Collection 3 request YAML into a Newman-compatible request', () => {
    const request = buildRequest(
      path.join(
        fixtureWorkspaceDir,
        'postman/collections/create-user/creating user.request.yaml'
      )
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
    const flow = buildFlow(
      path.join(fixtureWorkspaceDir, 'postman/collections/create-user')
    );

    expect(flow.name).toBe('create-user');
    expect(flow.description).toBe('create a test user');
    expect(flow.item.map((request) => request.name)).toEqual(['creating user']);
  });

  test('getCollection returns flows ordered by Collection 3 definition order', () => {
    const collection = getCollection(fixtureWorkspaceDir);

    expect(collection.info.name).toBe('workspace');
    expect(collection.item.map((flow) => flow.name)).toEqual(['create-user', 'get-otp']);
  });

  test('getEnvironmentByName normalizes Collection 3 environment files', () => {
    const environment = getEnvironmentByName('dev', fixtureWorkspaceDir);

    expect(environment.name).toBe('dev');
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
    const globals = getGlobals(fixtureWorkspaceDir);

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
