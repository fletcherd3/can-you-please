/**
 * Env picker screen tests.
 * Run via: npm test (tsc first, then node --test)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render } from "ink-testing-library";

import { EnvPickerScreen } from "../dist/ui/screens/EnvPickerScreen.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wait(ms = 80) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

function makeFlow(overrides = {}) {
  return {
    kind: "flow",
    folderPath: `/tmp/ws/flows/${overrides.name ?? "test-flow"}`,
    name: overrides.name ?? "test-flow",
    group: null,
    description: undefined,
    order: 100,
    environments: [],
    continueOnError: false,
    variables: {},
    requires: [],
    enums: {},
    requests: [],
    ...overrides,
  };
}

function makeEnv(id, name) {
  return {
    id,
    name: name ?? id,
    values: [],
    filePath: `/tmp/ws/envs/${id}.environment.yaml`,
  };
}

function makeProps(overrides = {}) {
  return {
    flow: makeFlow(),
    environments: [],
    onSelect: () => {},
    onBack: () => {},
    onHelp: () => {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rendering — title and footer
// ---------------------------------------------------------------------------

test("renders 'select environment' title", () => {
  const { lastFrame, unmount } = render(
    React.createElement(EnvPickerScreen, makeProps()),
  );
  assert.ok(
    lastFrame().includes("select environment"),
    `expected "select environment" in: ${lastFrame()}`,
  );
  unmount();
});

test("renders footer hints", () => {
  const { lastFrame, unmount } = render(
    React.createElement(EnvPickerScreen, makeProps()),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("↑↓ nav"), `missing footer hints in: ${frame}`);
  assert.ok(frame.includes("esc back"), `missing "esc back" in: ${frame}`);
  assert.ok(frame.includes("? help"), `missing "? help" in: ${frame}`);
  unmount();
});

// ---------------------------------------------------------------------------
// Environment list rendering
// ---------------------------------------------------------------------------

test("shows all workspace envs when flow declares zero environments", () => {
  const flow = makeFlow({ environments: [] });
  const envs = [makeEnv("dev", "development"), makeEnv("prod", "production")];
  const { lastFrame, unmount } = render(
    React.createElement(
      EnvPickerScreen,
      makeProps({ flow, environments: envs }),
    ),
  );
  const frame = lastFrame();
  assert.ok(
    frame.includes("development"),
    `expected "development" in: ${frame}`,
  );
  assert.ok(frame.includes("production"), `expected "production" in: ${frame}`);
  unmount();
});

test("shows only declared envs when flow declares multiple environments", () => {
  const flow = makeFlow({ environments: ["dev"] });
  const envs = [makeEnv("dev", "development"), makeEnv("prod", "production")];
  const { lastFrame, unmount } = render(
    React.createElement(
      EnvPickerScreen,
      makeProps({ flow, environments: envs }),
    ),
  );
  const frame = lastFrame();
  assert.ok(
    frame.includes("development"),
    `expected "development" in: ${frame}`,
  );
  assert.ok(
    !frame.includes("production"),
    `did not expect "production" in: ${frame}`,
  );
  unmount();
});

test("shows all workspace envs for a broken flow", () => {
  const flow = {
    kind: "broken-flow",
    folderPath: "/tmp/ws/flows/bad",
    reason: "missing definition.yaml",
  };
  const envs = [makeEnv("dev", "development"), makeEnv("staging", "staging")];
  const { lastFrame, unmount } = render(
    React.createElement(
      EnvPickerScreen,
      makeProps({ flow, environments: envs }),
    ),
  );
  const frame = lastFrame();
  assert.ok(
    frame.includes("development"),
    `expected "development" in: ${frame}`,
  );
  assert.ok(frame.includes("staging"), `expected "staging" in: ${frame}`);
  unmount();
});

test("shows 'nothing here, sorry!' when no matching envs", () => {
  const flow = makeFlow({ environments: ["unknown-env"] });
  const envs = [makeEnv("dev", "development")];
  const { lastFrame, unmount } = render(
    React.createElement(
      EnvPickerScreen,
      makeProps({ flow, environments: envs }),
    ),
  );
  const frame = lastFrame();
  assert.ok(
    frame.includes("nothing here, sorry!"),
    `expected empty-state text in: ${frame}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — esc returns to flow picker
// ---------------------------------------------------------------------------

test("esc calls onBack", async () => {
  let backCalled = false;
  const envs = [makeEnv("dev", "development")];
  const { stdin, unmount } = render(
    React.createElement(
      EnvPickerScreen,
      makeProps({
        environments: envs,
        onBack: () => {
          backCalled = true;
        },
      }),
    ),
  );
  stdin.write("\x1b");
  await wait();
  assert.ok(backCalled, "onBack should be called on ESC");
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — enter selects environment
// ---------------------------------------------------------------------------

test("enter on an env item calls onSelect with the environment object", async () => {
  let selected = null;
  const envs = [makeEnv("dev", "development"), makeEnv("prod", "production")];
  const { stdin, unmount } = render(
    React.createElement(
      EnvPickerScreen,
      makeProps({
        environments: envs,
        onSelect: (env) => {
          selected = env;
        },
      }),
    ),
  );
  stdin.write("\r"); // enter on first item
  await wait();
  assert.ok(selected !== null, "onSelect should have been called");
  assert.equal(selected.id, "dev");
  unmount();
});

test("down arrow then enter selects the second env", async () => {
  let selected = null;
  const envs = [makeEnv("dev", "development"), makeEnv("prod", "production")];
  const { stdin, unmount } = render(
    React.createElement(
      EnvPickerScreen,
      makeProps({
        environments: envs,
        onSelect: (env) => {
          selected = env;
        },
      }),
    ),
  );
  stdin.write("\x1b[B"); // down arrow
  await wait(40);
  stdin.write("\r"); // enter
  await wait();
  assert.ok(selected !== null, "onSelect should have been called");
  assert.equal(selected.id, "prod");
  unmount();
});

// ---------------------------------------------------------------------------
// initialEnvId — pre-selection
// ---------------------------------------------------------------------------

test("cursor is positioned on initialEnvId when provided", async () => {
  let selected = null;
  const envs = [
    makeEnv("dev", "dev"),
    makeEnv("staging", "staging"),
    makeEnv("prod", "prod"),
  ];
  const { stdin, unmount } = render(
    React.createElement(
      EnvPickerScreen,
      makeProps({
        environments: envs,
        initialEnvId: "staging",
        onSelect: (env) => {
          selected = env;
        },
      }),
    ),
  );
  // Pressing enter immediately should select "staging" (initial cursor position)
  stdin.write("\r");
  await wait();
  assert.ok(selected !== null, "onSelect should have been called");
  assert.equal(selected.id, "staging");
  unmount();
});

test("unknown initialEnvId defaults to index 0", async () => {
  let selected = null;
  const envs = [makeEnv("dev", "dev"), makeEnv("prod", "prod")];
  const { stdin, unmount } = render(
    React.createElement(
      EnvPickerScreen,
      makeProps({
        environments: envs,
        initialEnvId: "nonexistent",
        onSelect: (env) => {
          selected = env;
        },
      }),
    ),
  );
  stdin.write("\r");
  await wait();
  assert.ok(selected !== null, "onSelect should have been called");
  assert.equal(selected.id, "dev");
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — ? opens help
// ---------------------------------------------------------------------------

test("? key calls onHelp", async () => {
  let helpCalled = false;
  const envs = [makeEnv("dev", "development")];
  const { stdin, unmount } = render(
    React.createElement(
      EnvPickerScreen,
      makeProps({
        environments: envs,
        onHelp: () => {
          helpCalled = true;
        },
      }),
    ),
  );
  stdin.write("?");
  await wait();
  assert.ok(helpCalled, "onHelp should be called on ?");
  unmount();
});

// ---------------------------------------------------------------------------
// Filtered list — flow with multiple declared envs
// ---------------------------------------------------------------------------

test("flow with two declared envs shows exactly those two", () => {
  const flow = makeFlow({ environments: ["dev", "staging"] });
  const envs = [
    makeEnv("dev", "dev"),
    makeEnv("staging", "staging"),
    makeEnv("prod", "prod"),
  ];
  const { lastFrame, unmount } = render(
    React.createElement(
      EnvPickerScreen,
      makeProps({ flow, environments: envs }),
    ),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("dev"), `expected "dev" in: ${frame}`);
  assert.ok(frame.includes("staging"), `expected "staging" in: ${frame}`);
  assert.ok(!frame.includes("prod"), `did not expect "prod" in: ${frame}`);
  unmount();
});
