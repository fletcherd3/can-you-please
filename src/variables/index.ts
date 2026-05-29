import type { Environment, Flow, Globals } from "../domain.js";

export interface VariableMeta {
  name: string;
  required: boolean;
  enums: string[];
  defaultValue: string | undefined;
}

export type VariableLayer = Record<string, string>;

// Matches every {{name}} token in a string.
const TOKEN_RE = /\{\{([^}]+)\}\}/g;

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
