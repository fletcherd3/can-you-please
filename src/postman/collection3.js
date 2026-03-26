const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const COLLECTION_ROOT = path.join(__dirname, 'collections', 'cyp');
const ENVIRONMENTS_ROOT = path.join(__dirname, 'environments');
const GLOBALS_PATH = path.join(__dirname, 'globals', 'workspace.globals.yaml');
const COLLECTION_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

function loadYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
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

function getFlowDirectories() {
  return fs
    .readdirSync(COLLECTION_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => path.join(COLLECTION_ROOT, entry.name));
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

function getCollection() {
  const items = getFlowDirectories()
    .map(buildFlow)
    .sort((left, right) => left.order - right.order)
    .map(({ order, ...flow }) => flow);

  return {
    info: {
      name: 'cyp',
      schema: COLLECTION_SCHEMA,
    },
    item: items,
  };
}

function getEnvironmentByName(env) {
  const filePath = path.join(ENVIRONMENTS_ROOT, `cyp_${env}.environment.yaml`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Invalid environment: ${env}. Use 'dev' or 'sand'`);
  }

  return normalizeVariableContainer(loadYaml(filePath));
}

function getGlobals() {
  return normalizeVariableContainer(loadYaml(GLOBALS_PATH));
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

module.exports = {
  buildFlow,
  buildRequest,
  getCollection,
  getEnvironmentByName,
  getGlobals,
  normalizeVariableContainer,
};
