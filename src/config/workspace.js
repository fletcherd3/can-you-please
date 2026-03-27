const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_DIR_NAME = '.can-you-please';
const CONFIG_FILE_NAME = 'config.json';

function getConfigDir() {
  return path.join(os.homedir(), CONFIG_DIR_NAME);
}

function getConfigPath() {
  return path.join(getConfigDir(), CONFIG_FILE_NAME);
}

function readConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function getWorkspacePaths(workspaceDir) {
  const root = path.resolve(expandHomeDirectory(workspaceDir));

  return {
    root,
    postmanDir: path.join(root, 'postman'),
    collectionsDir: path.join(root, 'postman', 'collections'),
    environmentsDir: path.join(root, 'postman', 'environments'),
    globalsDir: path.join(root, 'postman', 'globals'),
    metadataPath: path.join(root, '.postman', 'resources.yaml'),
  };
}

function expandHomeDirectory(value) {
  if (value === '~') {
    return os.homedir();
  }

  if (value.startsWith(`~${path.sep}`)) {
    return path.join(os.homedir(), value.slice(2));
  }

  return value;
}

function validateWorkspaceDir(workspaceDir) {
  if (!workspaceDir || workspaceDir.trim().length === 0) {
    throw new Error('A workspace directory is required.');
  }

  const paths = getWorkspacePaths(workspaceDir);

  if (!fs.existsSync(paths.root) || !fs.statSync(paths.root).isDirectory()) {
    throw new Error(`Workspace directory not found: ${paths.root}`);
  }

  if (!fs.existsSync(paths.collectionsDir) || !fs.statSync(paths.collectionsDir).isDirectory()) {
    throw new Error(`Missing required directory: ${paths.collectionsDir}`);
  }

  if (
    !fs.existsSync(paths.environmentsDir) ||
    !fs.statSync(paths.environmentsDir).isDirectory()
  ) {
    throw new Error(`Missing required directory: ${paths.environmentsDir}`);
  }

  const collectionDirectories = fs
    .readdirSync(paths.collectionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .filter((entry) =>
      fs
        .readdirSync(path.join(paths.collectionsDir, entry.name), { withFileTypes: true })
        .some((child) => child.isFile() && child.name.endsWith('.request.yaml'))
    );

  if (collectionDirectories.length === 0) {
    throw new Error(`No Collection 3 collections were found in: ${paths.collectionsDir}`);
  }

  const environmentFiles = fs
    .readdirSync(paths.environmentsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.environment.yaml'));

  if (environmentFiles.length === 0) {
    throw new Error(`No environment files were found in: ${paths.environmentsDir}`);
  }

  return paths;
}

function saveConfig(config) {
  fs.mkdirSync(getConfigDir(), { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

function saveWorkspaceDir(workspaceDir) {
  const paths = validateWorkspaceDir(workspaceDir);
  saveConfig({ workspaceDir: paths.root });
  return paths.root;
}

function getWorkspaceDir() {
  const config = readConfig();

  if (!config.workspaceDir) {
    throw new Error('No Collection 3 workspace configured. Run `can-you-please setup`.');
  }

  return validateWorkspaceDir(config.workspaceDir).root;
}

module.exports = {
  getConfigDir,
  getConfigPath,
  expandHomeDirectory,
  getWorkspaceDir,
  getWorkspacePaths,
  readConfig,
  saveConfig,
  saveWorkspaceDir,
  validateWorkspaceDir,
};
