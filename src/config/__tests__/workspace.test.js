const fs = require('fs');
const os = require('os');
const path = require('path');
const realOs = jest.requireActual('os');

jest.mock('os');

const {
  getConfigPath,
  getWorkspaceDir,
  readConfig,
  saveWorkspaceDir,
  validateWorkspaceDir,
} = require('../workspace');

function createWorkspaceFixture(rootDir) {
  fs.mkdirSync(path.join(rootDir, 'postman', 'collections', 'demo-flow'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'postman', 'environments'), { recursive: true });
  fs.writeFileSync(
    path.join(rootDir, 'postman', 'collections', 'demo-flow', 'request.request.yaml'),
    '$kind: http-request\nurl: https://example.com\nmethod: GET\n'
  );
  fs.writeFileSync(
    path.join(rootDir, 'postman', 'environments', 'dev.environment.yaml'),
    'name: dev\nvalues: []\n'
  );
}

describe('workspace config', () => {
  let homeDir;

  beforeEach(() => {
    homeDir = fs.mkdtempSync(path.join(realOs.tmpdir(), 'cyp-home-'));
    os.homedir.mockReturnValue(homeDir);
  });

  test('readConfig returns empty object when config is missing', () => {
    expect(readConfig()).toEqual({});
  });

  test('saveWorkspaceDir stores a validated absolute workspace path', () => {
    const workspaceDir = fs.mkdtempSync(path.join(realOs.tmpdir(), 'cyp-workspace-'));
    createWorkspaceFixture(workspaceDir);

    const savedPath = saveWorkspaceDir(workspaceDir);
    const config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));

    expect(savedPath).toBe(path.resolve(workspaceDir));
    expect(config).toEqual({ workspaceDir: path.resolve(workspaceDir) });
  });

  test('saveWorkspaceDir expands ~ paths before saving', () => {
    const workspaceDir = path.join(homeDir, 'workspace');
    createWorkspaceFixture(workspaceDir);

    const savedPath = saveWorkspaceDir('~/workspace');

    expect(savedPath).toBe(workspaceDir);
  });

  test('validateWorkspaceDir rejects invalid workspace paths', () => {
    const workspaceDir = fs.mkdtempSync(path.join(realOs.tmpdir(), 'cyp-invalid-'));

    expect(() => validateWorkspaceDir(workspaceDir)).toThrow(
      `Missing required directory: ${path.join(workspaceDir, 'postman', 'collections')}`
    );
  });

  test('getWorkspaceDir throws a setup message when config is missing', () => {
    expect(() => getWorkspaceDir()).toThrow(
      'No Collection 3 workspace configured. Run `can-you-please setup`.'
    );
  });
});
