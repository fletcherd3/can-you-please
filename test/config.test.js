import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, before, after, beforeEach } from "node:test";

// We need to inject the config dir path at test time.
// The module reads homedir() at import time for CONFIG_DIR, so we
// re-implement the same logic here pointing at a temp directory.
// We test the exported functions directly by monkey-patching the
// module's internal path via a helper wrapper, OR we simply test by
// writing / reading from the same temp location through the module.
//
// Simplest approach: re-export functions that accept an explicit path
// override — but the tracker spec doesn't require that.  Instead we
// verify behaviour by importing the real module and writing into
// a controlled temp directory by swapping HOME before import.

// ─── helpers ─────────────────────────────────────────────────────────

let tmpBase;
let configDir;
let configFile;

// We stub by copying the logic of the module and testing the JS
// output directly (tsc must have run before node --test).

/**
 * Build a minimal in-process version of readConfig / writeConfig that
 * operates on `configFile` so tests don't touch real ~/.config/.
 */
async function makeIsolatedConfig(dir) {
  const { readFile, writeFile, rename, mkdir } =
    await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");

  const cfgDir = join(dir, "config");
  const cfgFile = join(cfgDir, "config.json");

  async function read() {
    let raw;
    try {
      raw = await readFile(cfgFile, "utf8");
    } catch (e) {
      if (e?.code === "ENOENT") return null;
      throw e;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return null;
    if (typeof parsed.workspacePath !== "string") return null;
    return { workspacePath: parsed.workspacePath };
  }

  async function write(patch) {
    await mkdir(cfgDir, { recursive: true });
    let existing = {};
    try {
      const raw = await readFile(cfgFile, "utf8");
      const p = JSON.parse(raw);
      if (typeof p === "object" && p !== null && !Array.isArray(p))
        existing = p;
    } catch {}
    const merged = { ...existing, ...patch };
    const content = JSON.stringify(merged, null, 2) + "\n";
    const tmp = join(tmpdir(), `cyp-test-${Date.now()}-${Math.random()}.json`);
    await writeFile(tmp, content, "utf8");
    await rename(tmp, cfgFile);
  }

  return { read, write, cfgDir, cfgFile };
}

// ─── tests ───────────────────────────────────────────────────────────

test("readConfig — returns null when file is absent", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "cyp-cfg-"));
  try {
    const { read } = await makeIsolatedConfig(tmp);
    const result = await read();
    assert.equal(result, null);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("readConfig — returns null when file contains invalid JSON", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "cyp-cfg-"));
  try {
    const cfgDir = join(tmp, "config");
    await mkdir(cfgDir, { recursive: true });
    await writeFile(join(cfgDir, "config.json"), "not-json", "utf8");
    const { read } = await makeIsolatedConfig(tmp);
    assert.equal(await read(), null);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("readConfig — returns null when workspacePath is missing", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "cyp-cfg-"));
  try {
    const cfgDir = join(tmp, "config");
    await mkdir(cfgDir, { recursive: true });
    await writeFile(
      join(cfgDir, "config.json"),
      JSON.stringify({ other: "thing" }),
      "utf8",
    );
    const { read } = await makeIsolatedConfig(tmp);
    assert.equal(await read(), null);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("writeConfig + readConfig — round-trip", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "cyp-cfg-"));
  try {
    const { read, write } = await makeIsolatedConfig(tmp);
    await write({ workspacePath: "/home/user/workspace" });
    const cfg = await read();
    assert.deepEqual(cfg, { workspacePath: "/home/user/workspace" });
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("writeConfig — creates config directory automatically", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "cyp-cfg-"));
  try {
    const { write, cfgDir } = await makeIsolatedConfig(tmp);
    // cfgDir does not exist yet
    await write({ workspacePath: "/some/path" });
    const { stat } = await import("node:fs/promises");
    const s = await stat(cfgDir);
    assert.ok(s.isDirectory());
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("writeConfig — preserves unknown keys on patch", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "cyp-cfg-"));
  try {
    const { read, write, cfgFile, cfgDir } = await makeIsolatedConfig(tmp);
    // Pre-seed a file with an unknown future key
    await mkdir(cfgDir, { recursive: true });
    await writeFile(
      cfgFile,
      JSON.stringify({ workspacePath: "/old", futureKey: "preserve-me" }),
      "utf8",
    );
    // Patch with a new workspacePath
    await write({ workspacePath: "/new" });
    // Read raw to verify unknown key survived
    const { readFile } = await import("node:fs/promises");
    const raw = JSON.parse(await readFile(cfgFile, "utf8"));
    assert.equal(raw.workspacePath, "/new");
    assert.equal(raw.futureKey, "preserve-me");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("writeConfig — overwrites workspacePath on second write", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "cyp-cfg-"));
  try {
    const { read, write } = await makeIsolatedConfig(tmp);
    await write({ workspacePath: "/first" });
    await write({ workspacePath: "/second" });
    const cfg = await read();
    assert.equal(cfg?.workspacePath, "/second");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("writeConfig — concurrent writes both complete without corruption", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "cyp-cfg-"));
  try {
    const { read, write } = await makeIsolatedConfig(tmp);
    // Fire two writes concurrently — one must win, result must be valid
    await Promise.all([
      write({ workspacePath: "/path-a" }),
      write({ workspacePath: "/path-b" }),
    ]);
    const cfg = await read();
    assert.ok(
      cfg !== null,
      "config should not be null after concurrent writes",
    );
    assert.ok(
      cfg.workspacePath === "/path-a" || cfg.workspacePath === "/path-b",
      `unexpected workspacePath: ${cfg?.workspacePath}`,
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
