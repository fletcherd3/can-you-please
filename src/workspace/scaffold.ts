import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Scaffold template content
// ---------------------------------------------------------------------------

const EXAMPLE_DEFINITION_YAML = `\
$kind: collection
name: example flow
description: an example api flow — edit me!
`;

const EXAMPLE_REQUEST_YAML = `\
$kind: http-request
url: https://httpbin.org/get
method: GET
headers: {}
order: 1000
`;

const EXAMPLE_ENV_YAML = `\
name: dev
values:
  - key: base
    value: api.example.com
    enabled: true
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scaffold a new Collection 3 workspace at `<parentDir>/<name>/`.
 * Creates the directory tree, an example flow, and a dev environment
 * file. The resulting workspace passes `isValidWorkspace()` immediately.
 *
 * Returns the absolute path of the created workspace root.
 */
export async function scaffoldWorkspace(
  parentDir: string,
  name: string,
): Promise<string> {
  const workspacePath = join(parentDir, name);
  const collectionDir = join(
    workspacePath,
    "postman",
    "collections",
    "example-flow",
  );
  const resourcesDir = join(collectionDir, ".resources");
  const envsDir = join(workspacePath, "postman", "environments");
  const globalsDir = join(workspacePath, "postman", "globals");

  await mkdir(resourcesDir, { recursive: true });
  await mkdir(envsDir, { recursive: true });
  await mkdir(globalsDir, { recursive: true });

  await writeFile(
    join(collectionDir, "01-example.request.yaml"),
    EXAMPLE_REQUEST_YAML,
    "utf-8",
  );
  await writeFile(
    join(resourcesDir, "definition.yaml"),
    EXAMPLE_DEFINITION_YAML,
    "utf-8",
  );
  await writeFile(
    join(envsDir, "dev.environment.yaml"),
    EXAMPLE_ENV_YAML,
    "utf-8",
  );

  return workspacePath;
}
