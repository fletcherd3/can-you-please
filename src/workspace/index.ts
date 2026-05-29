import { readdir, readFile, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { parse as parseYaml } from "yaml";
import { isValidJsonBody } from "./json-body.js";
import type {
  AnyFlow,
  BrokenFlow,
  EnvValue,
  Environment,
  Flow,
  Globals,
  Request,
  RequestBody,
  Script,
  Workspace,
} from "../domain.js";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readYaml(filePath: string): Promise<unknown> {
  const text = await readFile(filePath, "utf8");
  return parseYaml(text);
}

async function readText(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

/** readdir that returns an empty array instead of throwing when dir is absent */
async function readdirSafe(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

/**
 * readdir that returns only the names of sub-directories;
 * returns [] when the directory is absent.
 */
async function readdirDirsSafe(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// EnvValue / shared parser
// ---------------------------------------------------------------------------

function parseEnvValues(raw: unknown): EnvValue[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((v) => ({
    key: String(v["key"] ?? ""),
    value: String(v["value"] ?? ""),
    enabled: v["enabled"] !== false,
    source: "globals-file",
  }));
}

// ---------------------------------------------------------------------------
// Environments
// ---------------------------------------------------------------------------

async function loadEnvironments(envDir: string): Promise<Environment[]> {
  const files = await readdirSafe(envDir);
  const envFiles = files.filter((f) => f.endsWith(".environment.yaml"));
  const results = await Promise.all(
    envFiles.map(async (file) => {
      const filePath = join(envDir, file);
      try {
        const raw = await readYaml(filePath);
        const r = raw as Record<string, unknown>;
        const id = basename(file, ".environment.yaml");
        return {
          id,
          name: r?.["name"] ? String(r["name"]) : id,
          values: parseEnvValues(r?.["values"]),
          filePath,
        } satisfies Environment;
      } catch {
        return null; // skip malformed env files
      }
    }),
  );
  return results.filter((e): e is Environment => e !== null);
}

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------

function parseWorkspaceEnvFile(text: string): EnvValue[] {
  const values: EnvValue[] = [];

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIdx = rawLine.indexOf("=");
    if (equalsIdx < 0) {
      throw new Error(
        `invalid .env line ${lineNumber}: expected KEY=VALUE, got ${JSON.stringify(rawLine)}`,
      );
    }

    const key = rawLine.slice(0, equalsIdx).trim();
    if (!key) {
      throw new Error(
        `invalid .env line ${lineNumber}: key is required before '='`,
      );
    }

    values.push({
      key,
      value: rawLine.slice(equalsIdx + 1),
      enabled: true,
      source: "workspace-env",
    });
  }

  return values;
}

async function loadWorkspaceEnvGlobals(rootPath: string): Promise<Globals | null> {
  const filePath = join(rootPath, ".env");
  if (!(await fileExists(filePath))) return null;

  const text = await readText(filePath);
  try {
    return {
      values: parseWorkspaceEnvFile(text),
      filePath,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid .env file";
    throw new Error(`failed to load ${filePath}: ${message}`);
  }
}

async function loadGlobals(globalsDir: string): Promise<Globals | null> {
  const files = await readdirSafe(globalsDir);
  const globalsFiles = files.filter((f) => f.endsWith(".globals.yaml"));
  if (globalsFiles.length === 0) return null;

  // Prefer workspace.globals.yaml when present
  const preferred = globalsFiles.find((f) => f === "workspace.globals.yaml");
  const file = preferred ?? globalsFiles[0]!;
  const filePath = join(globalsDir, file);
  try {
    const raw = await readYaml(filePath);
    return {
      values: parseEnvValues((raw as Record<string, unknown>)?.["values"]),
      filePath,
    };
  } catch {
    return null;
  }
}

function mergeGlobals(
  globals: Globals | null,
  workspaceEnvGlobals: Globals | null,
): Globals | null {
  if (!globals && !workspaceEnvGlobals) return null;

  const merged = new Map<string, EnvValue>();

  for (const value of globals?.values ?? []) {
    merged.set(value.key, value);
  }

  for (const value of workspaceEnvGlobals?.values ?? []) {
    merged.set(value.key, value);
  }

  return {
    values: Array.from(merged.values()),
    filePath: globals?.filePath ?? workspaceEnvGlobals?.filePath ?? "",
  };
}

// ---------------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------------

function parseRequest(raw: unknown, filePath: string): Request {
  const r = raw as Record<string, unknown>;

  if (r?.["$kind"] !== undefined && r["$kind"] !== "http-request") {
    throw new Error(`invalid $kind "${r["$kind"]}" (expected "http-request")`);
  }

  let body: RequestBody | undefined;
  if (r?.["body"] != null) {
    const b = r["body"] as Record<string, unknown>;
    const type = b["type"];
    if (type !== "json" && type !== "text") {
      throw new Error(`unsupported body type "${type}"`);
    }
    const content = String(b["content"] ?? "");
    if (type === "json" && !isValidJsonBody(content)) {
      throw new Error(
        `invalid JSON body in ${basename(filePath)}: not valid JSON`,
      );
    }
    body = { type, content };
  }

  const scripts: Script[] = [];
  if (Array.isArray(r?.["scripts"])) {
    for (const s of r["scripts"] as Record<string, unknown>[]) {
      scripts.push({
        type: (s["type"] ?? "afterResponse") as Script["type"],
        language: String(s["language"] ?? "text/javascript"),
        code: String(s["code"] ?? ""),
      });
    }
  }

  const headers: Record<string, string> = {};
  if (r?.["headers"] && typeof r["headers"] === "object") {
    for (const [k, v] of Object.entries(
      r["headers"] as Record<string, unknown>,
    )) {
      headers[k] = String(v);
    }
  }

  const name = basename(filePath).replace(/\.request\.yaml$/, "");
  return {
    name,
    url: String(r?.["url"] ?? ""),
    method: String(r?.["method"] ?? "GET").toUpperCase(),
    headers,
    body,
    scripts,
    order: typeof r?.["order"] === "number" ? (r["order"] as number) : 1000,
  };
}

// ---------------------------------------------------------------------------
// Definition parsing
// ---------------------------------------------------------------------------

interface ParsedDefinition {
  name: string;
  group: string | null;
  description?: string;
  order: number;
  environments: string[];
  continueOnError: boolean;
  variables: Record<string, string>;
  requires: string[];
  enums: Record<string, string[]>;
}

function parseDefinition(raw: unknown, filePath: string): ParsedDefinition {
  const r = raw as Record<string, unknown>;

  if (r?.["$kind"] !== undefined && r["$kind"] !== "collection") {
    throw new Error(
      `invalid $kind "${r["$kind"]}" in ${basename(filePath)} (expected "collection")`,
    );
  }

  const fullName = r?.["name"];
  if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
    throw new Error("missing or empty name field in definition.yaml");
  }

  const slashIdx = fullName.indexOf("/");
  let name: string;
  let group: string | null;
  if (slashIdx >= 0) {
    group = fullName.slice(0, slashIdx).trim();
    name = fullName.slice(slashIdx + 1).trim();
  } else {
    group = null;
    name = fullName.trim();
  }

  const variables: Record<string, string> = {};
  if (r?.["variables"] && typeof r["variables"] === "object") {
    for (const [k, v] of Object.entries(
      r["variables"] as Record<string, unknown>,
    )) {
      variables[k] = String(v);
    }
  }

  const enums: Record<string, string[]> = {};
  if (r?.["enums"] && typeof r["enums"] === "object") {
    for (const [k, v] of Object.entries(
      r["enums"] as Record<string, unknown>,
    )) {
      enums[k] = Array.isArray(v) ? (v as unknown[]).map(String) : [];
    }
  }

  return {
    name,
    group,
    description: r?.["description"] ? String(r["description"]) : undefined,
    order: typeof r?.["order"] === "number" ? (r["order"] as number) : 1000,
    environments: Array.isArray(r?.["environments"])
      ? (r["environments"] as unknown[]).map(String)
      : [],
    continueOnError: r?.["continueOnError"] === true,
    variables,
    requires: Array.isArray(r?.["requires"])
      ? (r["requires"] as unknown[]).map(String)
      : [],
    enums,
  };
}

// ---------------------------------------------------------------------------
// Flow loading
// ---------------------------------------------------------------------------

async function loadFlow(folderPath: string): Promise<AnyFlow | null> {
  let entries: string[];
  try {
    entries = await readdir(folderPath);
  } catch {
    return null;
  }

  const requestFiles = entries.filter((e) => e.endsWith(".request.yaml"));
  if (requestFiles.length === 0) {
    // No request files — not a flow at all; skip silently
    return null;
  }

  try {
    // Definition
    const defPath = join(folderPath, ".resources", "definition.yaml");
    if (!(await fileExists(defPath))) {
      return {
        kind: "broken-flow",
        folderPath,
        reason: "missing .resources/definition.yaml",
      } satisfies BrokenFlow;
    }

    const rawDef = await readYaml(defPath);
    const def = parseDefinition(rawDef, defPath);

    // Requests
    const requests: Request[] = [];
    const errors: string[] = [];
    for (const rf of requestFiles) {
      const rfPath = join(folderPath, rf);
      try {
        const rawReq = await readYaml(rfPath);
        requests.push(parseRequest(rawReq, rfPath));
      } catch (e) {
        errors.push(`${rf}: ${(e as Error).message}`);
      }
    }

    if (errors.length > 0) {
      return {
        kind: "broken-flow",
        folderPath,
        reason: errors.join("; "),
      } satisfies BrokenFlow;
    }

    requests.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    return {
      kind: "flow",
      folderPath,
      name: def.name,
      group: def.group,
      description: def.description,
      order: def.order,
      environments: def.environments,
      continueOnError: def.continueOnError,
      variables: def.variables,
      requires: def.requires,
      enums: def.enums,
      requests,
    } satisfies Flow;
  } catch (e) {
    return {
      kind: "broken-flow",
      folderPath,
      reason: (e as Error).message,
    } satisfies BrokenFlow;
  }
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

function compareFlows(a: Flow, b: Flow): number {
  const ga = a.group ?? "";
  const gb = b.group ?? "";

  // Ungrouped flows come before grouped flows
  if (ga === "" && gb !== "") return -1;
  if (ga !== "" && gb === "") return 1;

  // Both in same group (including both ungrouped): by order then name
  if (ga === gb) {
    if (a.order !== b.order) return a.order - b.order;
    return a.name.localeCompare(b.name);
  }

  // Different groups: alphabetical by group name
  return ga.localeCompare(gb);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function loadWorkspace(rootPath: string): Promise<Workspace> {
  const collectionsDir = join(rootPath, "postman", "collections");
  const environmentsDir = join(rootPath, "postman", "environments");
  const globalsDir = join(rootPath, "postman", "globals");

  // Load environments and globals in parallel
  const [environments, globals, workspaceEnvGlobals] = await Promise.all([
    loadEnvironments(environmentsDir),
    loadGlobals(globalsDir),
    loadWorkspaceEnvGlobals(rootPath),
  ]);

  // Load flows
  const flowDirNames = await readdirDirsSafe(collectionsDir);
  const flowResults = await Promise.all(
    flowDirNames.map((name) => loadFlow(join(collectionsDir, name))),
  );

  const allFlows = flowResults.filter((f): f is AnyFlow => f !== null);
  const goodFlows = allFlows.filter((f): f is Flow => f.kind === "flow");
  const brokenFlows = allFlows.filter(
    (f): f is BrokenFlow => f.kind === "broken-flow",
  );

  // Flag duplicate fully-qualified names on both parties
  const nameMap = new Map<string, Flow[]>();
  for (const flow of goodFlows) {
    const key = flow.group != null ? `${flow.group}/${flow.name}` : flow.name;
    const bucket = nameMap.get(key) ?? [];
    bucket.push(flow);
    nameMap.set(key, bucket);
  }
  for (const [, bucket] of nameMap) {
    if (bucket.length > 1) {
      for (const flow of bucket) {
        flow.duplicateWarning = bucket
          .filter((f) => f !== flow)
          .map((f) => f.folderPath)
          .join(", ");
      }
    }
  }

  goodFlows.sort(compareFlows);

  return {
    rootPath,
    flows: [...goodFlows, ...brokenFlows],
    environments,
    globals: mergeGlobals(globals, workspaceEnvGlobals),
  };
}

export function isValidWorkspace(ws: Workspace): boolean {
  return ws.flows.some((f) => f.kind === "flow") && ws.environments.length > 0;
}
