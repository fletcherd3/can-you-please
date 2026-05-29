import type { Environment, Flow, Globals } from "../domain.js";

export interface VariableMeta {
  name: string;
  required: boolean;
  enums: string[];
  defaultValue: string | undefined;
}

export type VariableLayer = Record<string, string>;

type VariableValueSource =
  | "flow-default"
  | "globals-file"
  | "workspace-env"
  | "environment"
  | "form-input";

export interface ResolvedVariableDisplay {
  value: string;
  runtimeValue: string;
  submittedValue: string;
  fromWorkspaceEnv: boolean;
  workspaceEnvKey?: string;
}

// Matches every {{name}} token in a string.
const TOKEN_RE = /\{\{([^}]+)\}\}/g;
const EXACT_TOKEN_RE = /^\{\{([^}]+)\}\}$/;

// Postman dynamic variables (for example {{$randomUUID}}) are resolved
// by Newman at request runtime. They must not be surfaced as user-input
// variables or passed through as blank values, otherwise we override the
// runtime resolver and break dynamic expansion.
function isDynamicVariableToken(name: string): boolean {
  return name.startsWith("$");
}

function scanTokens(text: string): string[] {
  const names: string[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    const name = m[1];
    if (!isDynamicVariableToken(name)) {
      names.push(name);
    }
  }
  return names;
}

function tokensFromRequest(req: {
  url: string;
  headers: Record<string, string>;
  body?: { content: string } | undefined;
}): string[] {
  const names: string[] = [];
  names.push(...scanTokens(req.url));
  for (const val of Object.values(req.headers)) {
    names.push(...scanTokens(val));
  }
  if (req.body) {
    names.push(...scanTokens(req.body.content));
  }
  return names;
}

/**
 * Scan every {{name}} token across a flow's request URLs, header values, and
 * body content. Returns one VariableMeta per unique name (first-seen order),
 * annotated with metadata from definition.yaml.
 */
export function detectVariables(flow: Flow): VariableMeta[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const req of flow.requests) {
    for (const name of tokensFromRequest(req)) {
      if (!seen.has(name)) {
        seen.add(name);
        ordered.push(name);
      }
    }
  }

  return ordered.map((name) => ({
    name,
    required: flow.requires.includes(name),
    enums: flow.enums[name] ?? [],
    defaultValue: flow.variables[name],
  }));
}

/**
 * Merge variable layers in precedence order (lowest → highest).
 * Accepts an array of plain key/value records; later entries win on collisions.
 *
 * NOTE: `pm.variables.set()` values are NOT part of this static merge —
 * they are applied at runtime by Newman during the run itself.
 */
export function mergeVariables(
  layers: VariableLayer[],
): Record<string, string> {
  return Object.assign({}, ...layers);
}

/**
 * Resolve the full variable map for a run.
 *
 * Precedence (lowest → highest):
 *   flow defaults  <  globals  <  environment  <  form input
 *
 * Variables listed in `flow.requires` that are absent from all supplied layers
 * are included in the result with value `""` so the variables form can flag
 * them as blank.
 */
export function resolveVariables(
  flow: Flow,
  env: Environment | null,
  globals: Globals | null,
  formInput: Record<string, string>,
): Record<string, string> {
  const globalsRecord: Record<string, string> = globals
    ? Object.fromEntries(
        globals.values.filter((v) => v.enabled).map((v) => [v.key, v.value]),
      )
    : {};

  const envRecord: Record<string, string> = env
    ? Object.fromEntries(
        env.values.filter((v) => v.enabled).map((v) => [v.key, v.value]),
      )
    : {};

  const result = mergeVariables([
    flow.variables,
    globalsRecord,
    envRecord,
    formInput,
  ]);

  // Seed required variables with "" if absent from all layers so the form
  // can identify which required fields the user still needs to fill in.
  for (const name of flow.requires) {
    if (!(name in result)) {
      result[name] = "";
    }
  }

  return result;
}

function buildSourceMap(
  flow: Flow,
  env: Environment | null,
  globals: Globals | null,
  formInput: Record<string, string>,
): Map<string, { value: string; source: VariableValueSource }> {
  const merged = new Map<string, { value: string; source: VariableValueSource }>();

  for (const [key, value] of Object.entries(flow.variables)) {
    merged.set(key, { value, source: "flow-default" });
  }

  for (const value of globals?.values ?? []) {
    if (!value.enabled) continue;
    merged.set(keyValueKey(value.key), {
      value: value.value,
      source: value.source === "workspace-env" ? "workspace-env" : "globals-file",
    });
  }

  for (const value of env?.values ?? []) {
    if (!value.enabled) continue;
    merged.set(keyValueKey(value.key), {
      value: value.value,
      source: "environment",
    });
  }

  for (const [key, value] of Object.entries(formInput)) {
    merged.set(key, { value, source: "form-input" });
  }

  for (const name of flow.requires) {
    if (!merged.has(name)) {
      merged.set(name, { value: "", source: "form-input" });
    }
  }

  return merged;
}

function keyValueKey(key: string): string {
  return key;
}

function resolveDisplayValue(
  key: string,
  merged: Map<string, { value: string; source: VariableValueSource }>,
  visiting: Set<string>,
): ResolvedVariableDisplay {
  if (visiting.has(key)) {
    const raw = merged.get(key)?.value ?? "";
    return {
      value: raw,
      runtimeValue: raw,
      submittedValue: raw,
      fromWorkspaceEnv: false,
    };
  }

  const entry = merged.get(key);
  if (!entry) {
    return {
      value: "",
      runtimeValue: "",
      submittedValue: "",
      fromWorkspaceEnv: false,
    };
  }

  const directFromWorkspaceEnv =
    entry.source === "workspace-env" && entry.value !== "";
  const aliasMatch = EXACT_TOKEN_RE.exec(entry.value);
  if (!aliasMatch) {
    return directFromWorkspaceEnv
      ? {
          value: key,
          runtimeValue: entry.value,
          submittedValue: entry.value,
          fromWorkspaceEnv: true,
          workspaceEnvKey: key,
        }
      : {
          value: entry.value,
          runtimeValue: entry.value,
          submittedValue: entry.value,
          fromWorkspaceEnv: false,
        };
  }

  visiting.add(key);
  const aliasKey = aliasMatch[1]!;
  const resolved = resolveDisplayValue(aliasKey, merged, visiting);
  visiting.delete(key);

  if (resolved.fromWorkspaceEnv) {
    return {
      value: resolved.workspaceEnvKey ?? aliasKey,
      runtimeValue: resolved.runtimeValue,
      submittedValue: `{{${resolved.workspaceEnvKey ?? aliasKey}}}`,
      fromWorkspaceEnv: true,
      workspaceEnvKey: resolved.workspaceEnvKey ?? aliasKey,
    };
  }

  return {
    value: resolved.value,
    runtimeValue: resolved.runtimeValue,
    submittedValue: resolved.submittedValue,
    fromWorkspaceEnv: false,
  };
}

export function resolveDisplayVariables(
  flow: Flow,
  env: Environment | null,
  globals: Globals | null,
  formInput: Record<string, string>,
): Record<string, ResolvedVariableDisplay> {
  const merged = buildSourceMap(flow, env, globals, formInput);
  const result: Record<string, ResolvedVariableDisplay> = {};

  for (const key of merged.keys()) {
    result[key] = resolveDisplayValue(key, merged, new Set<string>());
  }

  return result;
}
