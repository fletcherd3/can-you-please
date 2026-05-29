/**
 * Setup wizard screen tests.
 * Run via: npm test (tsc first, then node --test)
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render } from "ink-testing-library";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { SetupWizardScreen } from "../dist/ui/screens/SetupWizardScreen.js";
import { scaffoldWorkspace } from "../dist/workspace/scaffold.js";
import { isValidWorkspace } from "../dist/workspace/index.js";
import { loadWorkspace } from "../dist/workspace/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wait(ms = 50) {
  return new Promise((r) => setTimeout(r, ms));
}

async function makeTmpDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "cyp-test-"));
}

const tmpDirs = [];

after(async () => {
  for (const d of tmpDirs) {
    await fs.rm(d, { recursive: true, force: true }).catch(() => {});
  }
});

// ---------------------------------------------------------------------------
// Rendering — mode-select (default initial step)
// ---------------------------------------------------------------------------

test("renders setup wizard title", () => {
  const { lastFrame, unmount } = render(
    React.createElement(SetupWizardScreen, { onDone: () => {} }),
  );
  assert.ok(
    lastFrame().includes("setup wizard"),
    `expected "setup wizard" in: ${lastFrame()}`,
  );
  unmount();
});

test("renders both mode options", () => {
  const { lastFrame, unmount } = render(
    React.createElement(SetupWizardScreen, { onDone: () => {} }),
  );
  const frame = lastFrame();
  assert.ok(
    frame.includes("point me at an existing collection repo"),
    `missing first option in: ${frame}`,
  );
  assert.ok(
    frame.includes("scaffold a new one"),
    `missing second option in: ${frame}`,
  );
  unmount();
});

test("renders footer hotkeys on mode-select", () => {
  const { lastFrame, unmount } = render(
    React.createElement(SetupWizardScreen, { onDone: () => {} }),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("navigate"), `missing navigate hint in: ${frame}`);
  assert.ok(frame.includes("select"), `missing select hint in: ${frame}`);
  unmount();
});

// ---------------------------------------------------------------------------
// Broken-path pre-fill
// ---------------------------------------------------------------------------

test("brokenPath: starts on existing-path step", () => {
  const { lastFrame, unmount } = render(
    React.createElement(SetupWizardScreen, {
      onDone: () => {},
      brokenPath: "/some/invalid/path",
    }),
  );
  const frame = lastFrame();
  assert.ok(
    frame.includes("workspace path:"),
    `expected "workspace path:" in: ${frame}`,
  );
  unmount();
});

test("brokenPath: pre-fills the path input", () => {
  const { lastFrame, unmount } = render(
    React.createElement(SetupWizardScreen, {
      onDone: () => {},
      brokenPath: "/some/invalid/path",
    }),
  );
  const frame = lastFrame();
  assert.ok(
    frame.includes("/some/invalid/path"),
    `expected broken path in: ${frame}`,
  );
  unmount();
});

test("brokenPath: shows inline validation error", () => {
  const { lastFrame, unmount } = render(
    React.createElement(SetupWizardScreen, {
      onDone: () => {},
      brokenPath: "/some/invalid/path",
    }),
  );
  const frame = lastFrame();
  assert.ok(
    frame.includes("no valid workspace found at that path"),
    `expected error message in: ${frame}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — mode-select navigation
// ---------------------------------------------------------------------------

test("down arrow moves selection to second mode", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(SetupWizardScreen, { onDone: () => {} }),
  );
  stdin.write("\x1b[B"); // down arrow
  await wait();
  const frame = lastFrame();
  // Second option should now be prefixed with "> "
  assert.ok(
    frame.includes("> scaffold a new one"),
    `expected "> scaffold a new one" in: ${frame}`,
  );
  unmount();
});

test("enter on first mode navigates to existing-path step", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(SetupWizardScreen, { onDone: () => {} }),
  );
  stdin.write("\r"); // enter
  await wait();
  const frame = lastFrame();
  assert.ok(
    frame.includes("workspace path:"),
    `expected "workspace path:" in: ${frame}`,
  );
  unmount();
});

test("enter on second mode navigates to scaffold-config step", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(SetupWizardScreen, { onDone: () => {} }),
  );
  stdin.write("\x1b[B"); // down
  await wait();
  stdin.write("\r"); // enter
  await wait();
  const frame = lastFrame();
  assert.ok(
    frame.includes("parent directory:"),
    `expected "parent directory:" in: ${frame}`,
  );
  assert.ok(
    frame.includes("workspace name:"),
    `expected "workspace name:" in: ${frame}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — existing-path input
// ---------------------------------------------------------------------------

test("existing-path: renders footer hotkeys", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(SetupWizardScreen, { onDone: () => {} }),
  );
  stdin.write("\r"); // navigate to existing-path
  await wait();
  const frame = lastFrame();
  assert.ok(
    frame.includes("tab complete"),
    `expected "tab complete" in: ${frame}`,
  );
  assert.ok(frame.includes("esc back"), `expected "esc back" in: ${frame}`);
  assert.ok(
    frame.includes("enter confirm"),
    `expected "enter confirm" in: ${frame}`,
  );
  unmount();
});

test("existing-path: typing appends characters to input", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(SetupWizardScreen, { onDone: () => {} }),
  );
  stdin.write("\r"); // navigate to existing-path
  await wait();
  stdin.write("/");
  stdin.write("t");
  stdin.write("m");
  stdin.write("p");
  await wait();
  const frame = lastFrame();
  assert.ok(frame.includes("/tmp"), `expected "/tmp" in: ${frame}`);
  unmount();
});

test("existing-path: backspace removes last character", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(SetupWizardScreen, { onDone: () => {} }),
  );
  stdin.write("\r"); // navigate to existing-path
  await wait();
  stdin.write("/");
  stdin.write("t");
  stdin.write("m");
  stdin.write("p");
  await wait();
  stdin.write("\x7f"); // backspace
  await wait();
  const frame = lastFrame();
  assert.ok(frame.includes("/tm"), `expected "/tm" in: ${frame}`);
  assert.ok(!frame.includes("/tmp█"), `should not have "/tmp" cursor`);
  unmount();
});

test("existing-path: esc goes back to mode-select", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(SetupWizardScreen, { onDone: () => {} }),
  );
  stdin.write("\r"); // navigate to existing-path
  await wait();
  stdin.write("\x1b"); // esc
  await wait();
  const frame = lastFrame();
  assert.ok(
    frame.includes("point me at an existing collection repo"),
    `expected mode-select in: ${frame}`,
  );
  unmount();
});

test("existing-path: invalid path shows inline error", async () => {
  let doneCalled = false;
  const { lastFrame, stdin, unmount } = render(
    React.createElement(SetupWizardScreen, {
      onDone: () => {
        doneCalled = true;
      },
    }),
  );
  stdin.write("\r"); // navigate to existing-path
  await wait();
  stdin.write("/");
  stdin.write("n");
  stdin.write("o");
  stdin.write("p");
  stdin.write("e");
  await wait();
  stdin.write("\r"); // submit
  await wait(200); // let async validation settle
  const frame = lastFrame();
  assert.ok(
    frame.includes("no valid workspace found at that path"),
    `expected inline error in: ${frame}`,
  );
  assert.ok(!doneCalled, "onDone should not have been called");
  unmount();
});

test("existing-path: malformed .env parse errors are shown inline", async () => {
  const tmpDir = await makeTmpDir();
  tmpDirs.push(tmpDir);

  const wsRoot = path.join(tmpDir, "bad-env-workspace");
  await fs.mkdir(path.join(wsRoot, "postman", "collections", "example-flow", ".resources"), {
    recursive: true,
  });
  await fs.mkdir(path.join(wsRoot, "postman", "environments"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(wsRoot, "postman", "collections", "example-flow", ".resources", "definition.yaml"),
    ['name: "example"', 'environments: ["dev"]'].join("\n"),
  );
  await fs.writeFile(
    path.join(wsRoot, "postman", "collections", "example-flow", "01-example.request.yaml"),
    ['url: "https://example.com"', 'method: "GET"'].join("\n"),
  );
  await fs.writeFile(
    path.join(wsRoot, "postman", "environments", "dev.environment.yaml"),
    ['name: "dev"', "values: []"].join("\n"),
  );
  await fs.writeFile(path.join(wsRoot, ".env"), "GOOD=value\nBROKEN_LINE\n");

  let doneCalled = false;
  const { lastFrame, stdin, unmount } = render(
    React.createElement(SetupWizardScreen, {
      onDone: () => {
        doneCalled = true;
      },
    }),
  );
  stdin.write("\r");
  await wait();
  for (const ch of wsRoot) stdin.write(ch);
  await wait();
  stdin.write("\r");
  await wait(250);
  const frame = lastFrame();
  assert.ok(
    frame.includes("failed to load") && frame.includes("BROKEN_LINE"),
    `expected parse error in: ${frame}`,
  );
  assert.ok(!doneCalled, "onDone should not have been called");
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — scaffold-config
// ---------------------------------------------------------------------------

test("scaffold-config: shows default workspace name", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(SetupWizardScreen, { onDone: () => {} }),
  );
  stdin.write("\x1b[B"); // down to scaffold option
  await wait();
  stdin.write("\r"); // select it
  await wait();
  const frame = lastFrame();
  assert.ok(
    frame.includes("can-you-please-collection"),
    `expected default name in: ${frame}`,
  );
  unmount();
});

test("scaffold-config: esc returns to mode-select", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(SetupWizardScreen, { onDone: () => {} }),
  );
  stdin.write("\x1b[B"); // down
  await wait();
  stdin.write("\r"); // enter scaffold mode
  await wait();
  stdin.write("\x1b"); // esc
  await wait();
  const frame = lastFrame();
  assert.ok(
    frame.includes("point me at an existing collection repo"),
    `expected mode-select in: ${frame}`,
  );
  unmount();
});

test("scaffold-config: empty parent shows inline error", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(SetupWizardScreen, { onDone: () => {} }),
  );
  stdin.write("\x1b[B"); // down to scaffold
  await wait();
  stdin.write("\r"); // select
  await wait();
  // navigate to name field and submit with empty parent
  stdin.write("\x1b[B"); // down to name
  await wait();
  stdin.write("\r"); // enter (submit)
  await wait(100);
  const frame = lastFrame();
  assert.ok(
    frame.includes("parent directory is required"),
    `expected error in: ${frame}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// scaffoldWorkspace integration tests
// ---------------------------------------------------------------------------

test("scaffoldWorkspace creates expected directory structure", async () => {
  const tmpDir = await makeTmpDir();
  tmpDirs.push(tmpDir);

  await scaffoldWorkspace(tmpDir, "my-workspace");

  const wsRoot = path.join(tmpDir, "my-workspace");

  // Check directories exist
  for (const dir of [
    path.join(wsRoot, "postman", "collections", "example-flow"),
    path.join(wsRoot, "postman", "collections", "example-flow", ".resources"),
    path.join(wsRoot, "postman", "environments"),
    path.join(wsRoot, "postman", "globals"),
  ]) {
    const stat = await fs.stat(dir);
    assert.ok(stat.isDirectory(), `expected directory at ${dir}`);
  }

  // Check files exist
  for (const file of [
    path.join(
      wsRoot,
      "postman",
      "collections",
      "example-flow",
      "01-example.request.yaml",
    ),
    path.join(
      wsRoot,
      "postman",
      "collections",
      "example-flow",
      ".resources",
      "definition.yaml",
    ),
    path.join(wsRoot, "postman", "environments", "dev.environment.yaml"),
  ]) {
    const stat = await fs.stat(file);
    assert.ok(stat.isFile(), `expected file at ${file}`);
  }
});

test("scaffoldWorkspace: result passes isValidWorkspace()", async () => {
  const tmpDir = await makeTmpDir();
  tmpDirs.push(tmpDir);

  const wsPath = await scaffoldWorkspace(tmpDir, "my-valid-ws");
  const ws = await loadWorkspace(wsPath);
  assert.ok(
    isValidWorkspace(ws),
    `scaffolded workspace should be valid; flows=${ws.flows.length}, envs=${ws.environments.length}`,
  );
});

test("scaffoldWorkspace: returns workspace root path", async () => {
  const tmpDir = await makeTmpDir();
  tmpDirs.push(tmpDir);

  const wsPath = await scaffoldWorkspace(tmpDir, "test-ws");
  assert.equal(wsPath, path.join(tmpDir, "test-ws"));
});

test("scaffoldWorkspace: created flow is valid (not broken)", async () => {
  const tmpDir = await makeTmpDir();
  tmpDirs.push(tmpDir);

  const wsPath = await scaffoldWorkspace(tmpDir, "check-flow");
  const ws = await loadWorkspace(wsPath);
  const goodFlows = ws.flows.filter((f) => f.kind === "flow");
  assert.ok(goodFlows.length >= 1, "expected at least one valid flow");
});

test("scaffoldWorkspace: created environment is present", async () => {
  const tmpDir = await makeTmpDir();
  tmpDirs.push(tmpDir);

  const wsPath = await scaffoldWorkspace(tmpDir, "check-env");
  const ws = await loadWorkspace(wsPath);
  assert.ok(ws.environments.length >= 1, "expected at least one environment");
  assert.equal(ws.environments[0].id, "dev");
});
