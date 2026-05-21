/**
 * App shell & screen state machine tests.
 * Run via: npm test (which calls tsc first, then node --test)
 *
 * Tests import compiled dist/ output and use ink-testing-library for
 * component assertions.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render } from "ink-testing-library";

// Screen stubs
import { SetupWizardScreen } from "../dist/ui/screens/SetupWizardScreen.js";
import { FlowPickerScreen } from "../dist/ui/screens/FlowPickerScreen.js";
import { EnvPickerScreen } from "../dist/ui/screens/EnvPickerScreen.js";
import { VariablesFormScreen } from "../dist/ui/screens/VariablesFormScreen.js";
import { RunViewScreen } from "../dist/ui/screens/RunViewScreen.js";
import { HelpOverlay } from "../dist/ui/screens/HelpOverlay.js";

// Minimal stub objects for props
const stubWorkspace = {
  rootPath: "/tmp/test-ws",
  flows: [],
  environments: [],
  globals: null,
};

const stubFlow = {
  kind: "flow",
  folderPath: "/tmp/test",
  name: "test-flow",
  group: null,
  order: 0,
  environments: [],
  continueOnError: false,
  variables: {},
  requires: [],
  enums: {},
  requests: [],
};

const stubEnv = {
  id: "dev",
  name: "dev",
  values: [],
  filePath: "/tmp/test/dev.environment.yaml",
};

// ---------------------------------------------------------------------------
// Screen stub rendering
// ---------------------------------------------------------------------------

test("SetupWizardScreen renders stub text", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(SetupWizardScreen, { onDone: () => {} }),
  );
  assert.ok(
    lastFrame().includes("setup wizard"),
    `expected "setup wizard" in: ${lastFrame()}`,
  );
  unmount();
});

test("FlowPickerScreen renders title", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: stubWorkspace,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  assert.ok(
    lastFrame().includes("flow picker"),
    `expected "flow picker" in: ${lastFrame()}`,
  );
  unmount();
});

test("EnvPickerScreen renders stub text", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(EnvPickerScreen, {
      flow: stubFlow,
      environments: [],
      onSelect: () => {},
      onBack: () => {},
      onHelp: () => {},
    }),
  );
  assert.ok(
    lastFrame().includes("env picker"),
    `expected "env picker" in: ${lastFrame()}`,
  );
  unmount();
});

test("VariablesFormScreen renders stub text", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(VariablesFormScreen, {
      flow: stubFlow,
      env: stubEnv,
      onSubmit: () => {},
      onBack: () => {},
      onHelp: () => {},
    }),
  );
  assert.ok(
    lastFrame().includes("variables form"),
    `expected "variables form" in: ${lastFrame()}`,
  );
  unmount();
});

test("RunViewScreen renders stub text", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(RunViewScreen, {
      flow: stubFlow,
      env: stubEnv,
      variables: {},
      continueOnError: false,
      onBack: () => {},
      onHelp: () => {},
    }),
  );
  assert.ok(
    lastFrame().includes("run view"),
    `expected "run view" in: ${lastFrame()}`,
  );
  unmount();
});

test("HelpOverlay renders stub text", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(HelpOverlay, { onClose: () => {} }),
  );
  assert.ok(
    lastFrame().includes("help overlay"),
    `expected "help overlay" in: ${lastFrame()}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard interaction
// ---------------------------------------------------------------------------

test("FlowPickerScreen: esc with no filter calls onQuit", async () => {
  let quitCalled = false;
  const { stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: stubWorkspace,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {
        quitCalled = true;
      },
      onHelp: () => {},
    }),
  );
  stdin.write("\x1b"); // esc
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(quitCalled, "onQuit should have been called on esc");
  unmount();
});

test("FlowPickerScreen: ? calls onHelp", async () => {
  let helpCalled = false;
  const { stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: stubWorkspace,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {
        helpCalled = true;
      },
    }),
  );
  stdin.write("?");
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(helpCalled, "onHelp should have been called on '?'");
  unmount();
});

test("EnvPickerScreen: esc calls onBack", async () => {
  let backCalled = false;
  const { stdin, unmount } = render(
    React.createElement(EnvPickerScreen, {
      flow: stubFlow,
      environments: [],
      onSelect: () => {},
      onBack: () => {
        backCalled = true;
      },
      onHelp: () => {},
    }),
  );
  // ESC byte
  stdin.write("\x1b");
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(backCalled, "onBack should have been called on ESC");
  unmount();
});

test("VariablesFormScreen: esc calls onBack", async () => {
  let backCalled = false;
  const { stdin, unmount } = render(
    React.createElement(VariablesFormScreen, {
      flow: stubFlow,
      env: stubEnv,
      onSubmit: () => {},
      onBack: () => {
        backCalled = true;
      },
      onHelp: () => {},
    }),
  );
  stdin.write("\x1b");
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(backCalled, "onBack should have been called on ESC");
  unmount();
});

test("RunViewScreen: esc calls onBack", async () => {
  let backCalled = false;
  const { stdin, unmount } = render(
    React.createElement(RunViewScreen, {
      flow: stubFlow,
      env: stubEnv,
      variables: {},
      continueOnError: false,
      onBack: () => {
        backCalled = true;
      },
      onHelp: () => {},
    }),
  );
  stdin.write("\x1b");
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(backCalled, "onBack should have been called on ESC");
  unmount();
});

test("HelpOverlay: esc calls onClose", async () => {
  let closeCalled = false;
  const { stdin, unmount } = render(
    React.createElement(HelpOverlay, {
      onClose: () => {
        closeCalled = true;
      },
    }),
  );
  stdin.write("\x1b");
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(closeCalled, "onClose should have been called on ESC");
  unmount();
});

test("HelpOverlay: ? calls onClose", async () => {
  let closeCalled = false;
  const { stdin, unmount } = render(
    React.createElement(HelpOverlay, {
      onClose: () => {
        closeCalled = true;
      },
    }),
  );
  stdin.write("?");
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(closeCalled, "onClose should have been called on '?'");
  unmount();
});
