const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { getWorkspaceDir } = require('../config/workspace');

const COLLECTION_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

function loadYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function resolveWorkspacePaths(workspaceDir = getWorkspaceDir()) {
  const root = path.resolve(workspaceDir);

  return {
    root,
    collectionsRoot: path.join(root, 'postman', 'collections'),
    environmentsRoot: path.join(root, 'postman', 'environments'),
    globalsRoot: path.join(root, 'postman', 'globals'),
    metadataPath: path.join(root, '.postman', 'resources.yaml'),
  };
}

function getFlowDirectories(workspaceDir) {
  const { collectionsRoot } = resolveWorkspacePaths(workspaceDir);

  return fs
    .readdirSync(collectionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => path.join(collectionsRoot, entry.name))
    .filter((flowDir) =>
      fs
        .readdirSync(flowDir, { withFileTypes: true })
        .some(
          (entry) =>
            entry.isFile() && entry.name.endsWith('.request.yaml')
        )
    );
}

function getDisplayNameFromRequestFile(filePath) {
  return path.basename(filePath, '.request.yaml');
}

function getEventListenType(type) {
  if (type === 'beforeRequest') return 'prerequest';
  if (type === 'afterResponse') return 'test';
  return type;
}

function buildEvent(script = {}) {
  return {
    listen: getEventListenType(script.type),
    script: {
      type: 'text/javascript',
      exec: (script.code || '').split('\n'),
      ...(script.language ? { language: script.language } : {}),
    },
  };
}

function buildHeaders(headers = {}) {
  if (Array.isArray(headers)) return headers;

  return Object.entries(headers).map(([key, value]) => ({
    key,
    value: String(value),
  }));
}

function buildRequestBody(body) {
  if (!body) return undefined;

  const content = body.content || '';
  const type = body.type || 'text';

  if (type === 'json') {
    return {
      mode: 'raw',
      raw: content,
      options: {
        raw: {
          language: 'json',
        },
      },
    };
  }

  return {
    mode: 'raw',
    raw: content,
  };
}

function buildRequest(requestFilePath) {
  const definition = loadYaml(requestFilePath);

  return {
    name: getDisplayNameFromRequestFile(requestFilePath),
    order: definition.order || 0,
    request: {
      method: definition.method || 'GET',
      header: buildHeaders(definition.headers),
      url: definition.url,
      ...(definition.body ? { body: buildRequestBody(definition.body) } : {}),
    },
    ...(definition.scripts
      ? {
        event: definition.scripts.map(buildEvent),
      }
      : {}),
  };
}

function buildFlow(flowDir) {
  const name = path.basename(flowDir);
  const definitionPath = path.join(flowDir, '.resources', 'definition.yaml');
  const definition = fs.existsSync(definitionPath) ? loadYaml(definitionPath) : {};

  const items = fs
    .readdirSync(flowDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.request.yaml'))
    .map((entry) => buildRequest(path.join(flowDir, entry.name)))
    .sort((left, right) => left.order - right.order)
    .map(({ order, ...request }) => request);

  return {
    name,
    description: definition.description || '',
    order: definition.order || 0,
    item: items,
  };
}

function getCollection(workspaceDir) {
  const { root } = resolveWorkspacePaths(workspaceDir);
  const items = getFlowDirectories(workspaceDir)
    .map(buildFlow)
    .sort((left, right) => left.order - right.order)
    .map(({ order, ...flow }) => flow);

  return {
    info: {
      name: path.basename(root),
      schema: COLLECTION_SCHEMA,
    },
    item: items,
  };
}

function normalizeVariableContainer(definition = {}) {
  return {
    ...(definition.name ? { name: definition.name } : {}),
    values: (definition.values || []).map((variable) => ({
      key: variable.key,
      value: variable.value,
      type: variable.type || 'default',
      enabled: variable.enabled !== false,
    })),
  };
}

function listEnvironmentFiles(workspaceDir) {
  const { environmentsRoot } = resolveWorkspacePaths(workspaceDir);

  return fs
    .readdirSync(environmentsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.environment.yaml'))
    .map((entry) => path.join(environmentsRoot, entry.name));
}

function scoreEnvironmentMatch(filePath, env, definitionName) {
  const normalizedEnv = env.toLowerCase();
  const baseName = path.basename(filePath, '.environment.yaml').toLowerCase();
  const yamlName = (definitionName || '').toLowerCase();

  if (baseName === normalizedEnv || yamlName === normalizedEnv) return 3;
  if (
    baseName.endsWith(`_${normalizedEnv}`) ||
    baseName.endsWith(`-${normalizedEnv}`) ||
    yamlName.endsWith(`_${normalizedEnv}`) ||
    yamlName.endsWith(`-${normalizedEnv}`)
  ) {
    return 2;
  }
  if (baseName.includes(normalizedEnv) || yamlName.includes(normalizedEnv)) return 1;
  return 0;
}

function getEnvironmentByName(env, workspaceDir) {
  const candidates = listEnvironmentFiles(workspaceDir)
    .map((filePath) => {
      const definition = loadYaml(filePath);
      return {
        filePath,
        definition,
        score: scoreEnvironmentMatch(filePath, env, definition.name),
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (candidates.length === 0) {
    throw new Error(`Invalid environment: ${env}. Use an environment available in your workspace.`);
  }

  const best = candidates[0];
  const equallyGood = candidates.filter((candidate) => candidate.score === best.score);
  if (equallyGood.length > 1) {
    throw new Error(`Environment '${env}' is ambiguous in the configured workspace.`);
  }

  return normalizeVariableContainer(best.definition);
}

function getGlobals(workspaceDir) {
  const { globalsRoot } = resolveWorkspacePaths(workspaceDir);

  if (!fs.existsSync(globalsRoot)) {
    return { values: [] };
  }

  const globalFiles = fs
    .readdirSync(globalsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.globals.yaml'))
    .map((entry) => path.join(globalsRoot, entry.name))
    .sort();

  if (globalFiles.length === 0) {
    return { values: [] };
  }

  const preferredFile =
    globalFiles.find((filePath) => path.basename(filePath) === 'workspace.globals.yaml') ||
    globalFiles[0];

  return normalizeVariableContainer(loadYaml(preferredFile));
}

module.exports = {
  buildFlow,
  buildRequest,
  getCollection,
  getEnvironmentByName,
  getGlobals,
  normalizeVariableContainer,
  resolveWorkspacePaths,
};
