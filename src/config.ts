import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export interface AppConfig {
  workspacePath: string;
}

const CONFIG_DIR = join(homedir(), ".config", "can-you-please");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

/**
 * Read the persisted config. Returns `null` when the file is absent
 * or cannot be parsed as a valid JSON object.
 */
export async function readConfig(): Promise<AppConfig | null> {
  let raw: string;
  try {
    raw = await readFile(CONFIG_FILE, "utf8");
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") return null;
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  if (typeof obj["workspacePath"] !== "string") return null;

  return { workspacePath: obj["workspacePath"] as string };
}

/**
 * Merge `patch` into the existing config and persist it atomically.
 * Unknown keys already in the file are preserved so that future
 * versions of the app can add fields without data loss.
 */
export async function writeConfig(patch: Partial<AppConfig>): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });

  // Read existing raw object so we can preserve unknown keys.
  let existing: Record<string, unknown> = {};
  try {
    const raw = await readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      existing = parsed as Record<string, unknown>;
    }
  } catch {
    // File absent or unparseable — start fresh.
  }

  const merged = { ...existing, ...patch };
  const content = JSON.stringify(merged, null, 2) + "\n";

  // Atomic write: write to a temp file then rename into place.
  const tmp = join(
    tmpdir(),
    `can-you-please-config-${process.pid}-${Date.now()}.json`,
  );
  await writeFile(tmp, content, "utf8");
  await rename(tmp, CONFIG_FILE);
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
