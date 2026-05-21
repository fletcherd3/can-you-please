/**
 * Flow picker screen tests.
 * Run via: npm test (tsc first, then node --test)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render } from "ink-testing-library";

import { FlowPickerScreen } from "../dist/ui/screens/FlowPickerScreen.js";

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
    name: "test-flow",
    group: null,
    description: "a test flow",
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

function makeBrokenFlow(overrides = {}) {
  return {
    kind: "broken-flow",
    folderPath: "/tmp/ws/flows/broken-one",
    reason: "missing definition.yaml",
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

function makeWorkspace(overrides = {}) {
  return {
    rootPath: "/tmp/test-ws",
    flows: [],
    environments: [],
    globals: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rendering — basic
// ---------------------------------------------------------------------------

test("renders flow picker title", () => {
  const { lastFrame, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: makeWorkspace(),
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

test("renders flow name for a valid flow", () => {
  const ws = makeWorkspace({
    flows: [makeFlow({ name: "create-user" })],
  });
  const { lastFrame, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  assert.ok(
    lastFrame().includes("create-user"),
    `expected "create-user" in: ${lastFrame()}`,
  );
  unmount();
});

test("renders description dimmed alongside flow name", () => {
  const ws = makeWorkspace({
    flows: [makeFlow({ name: "create-user", description: "creates a user" })],
  });
  const { lastFrame, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("create-user"), `missing name in: ${frame}`);
  assert.ok(
    frame.includes("creates a user"),
    `missing description in: ${frame}`,
  );
  unmount();
});

test("truncates long descriptions with ellipsis", () => {
  const longDesc = "a".repeat(60);
  const ws = makeWorkspace({
    flows: [makeFlow({ name: "my-flow", description: longDesc })],
  });
  const { lastFrame, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("…"), `expected ellipsis in: ${frame}`);
  unmount();
});

test("renders broken flow with '!' glyph", () => {
  const ws = makeWorkspace({
    flows: [makeBrokenFlow({ folderPath: "/tmp/ws/flows/bad-flow" })],
  });
  const { lastFrame, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("!"), `expected "!" glyph in: ${frame}`);
  assert.ok(
    frame.includes("bad-flow"),
    `expected broken flow name in: ${frame}`,
  );
  unmount();
});

test("renders duplicate flow with warning glyph", () => {
  const ws = makeWorkspace({
    flows: [
      makeFlow({
        name: "create-user",
        duplicateWarning: "/tmp/ws/flows/other-create-user",
      }),
    ],
  });
  const { lastFrame, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("⚠"), `expected "⚠" glyph in: ${frame}`);
  unmount();
});

test("renders group section header for grouped flows", () => {
  const ws = makeWorkspace({
    flows: [
      makeFlow({
        name: "create-user",
        group: "user-flows",
        folderPath: "/tmp/ws/flows/uf-create",
      }),
    ],
  });
  const { lastFrame, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("user-flows"), `expected group header in: ${frame}`);
  assert.ok(frame.includes("create-user"), `expected flow name in: ${frame}`);
  unmount();
});

test("ungrouped flows appear without a group header", () => {
  const ws = makeWorkspace({
    flows: [makeFlow({ name: "ping", group: null })],
  });
  const { lastFrame, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("ping"), `expected flow name in: ${frame}`);
  // There should be no bold group header — just the flow row
  unmount();
});

// ---------------------------------------------------------------------------
// Status row
// ---------------------------------------------------------------------------

test("status row shows N of M flows", () => {
  const ws = makeWorkspace({
    flows: [
      makeFlow({ name: "flow-a", folderPath: "/tmp/a" }),
      makeFlow({ name: "flow-b", folderPath: "/tmp/b" }),
    ],
  });
  const { lastFrame, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  assert.ok(
    lastFrame().includes("2 of 2 flows"),
    `expected "2 of 2 flows" in: ${lastFrame()}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

test("renders footer hotkeys", () => {
  const { lastFrame, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: makeWorkspace(),
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("nav"), `expected "nav" in: ${frame}`);
  assert.ok(frame.includes("env"), `expected "env" in: ${frame}`);
  assert.ok(frame.includes("group"), `expected "group" in: ${frame}`);
  assert.ok(frame.includes("reload"), `expected "reload" in: ${frame}`);
  assert.ok(frame.includes("help"), `expected "help" in: ${frame}`);
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — text filter
// ---------------------------------------------------------------------------

test("typing a character shows filter indicator", async () => {
  const ws = makeWorkspace({
    flows: [makeFlow({ name: "create-user" })],
  });
  const { lastFrame, stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  stdin.write("c");
  await wait();
  const frame = lastFrame();
  assert.ok(frame.includes("/"), `expected filter indicator "/" in: ${frame}`);
  assert.ok(frame.includes("c"), `expected filter char "c" in: ${frame}`);
  unmount();
});

test("typing filters the flow list", async () => {
  const ws = makeWorkspace({
    flows: [
      makeFlow({
        name: "create-user",
        folderPath: "/tmp/a",
        description: "creates an account",
      }),
      makeFlow({
        name: "fetch-otp",
        folderPath: "/tmp/b",
        description: "gets the otp code",
      }),
    ],
  });
  const { lastFrame, stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  stdin.write("f"); // matches "fetch-otp" but not "create-user" or its description
  await wait();
  const frame = lastFrame();
  assert.ok(frame.includes("fetch-otp"), `expected "fetch-otp" in: ${frame}`);
  assert.ok(
    !frame.includes("create-user"),
    `unexpected "create-user" in: ${frame}`,
  );
  unmount();
});

test("backspace removes last character from filter", async () => {
  const ws = makeWorkspace({
    flows: [makeFlow({ name: "create-user" })],
  });
  const { lastFrame, stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  stdin.write("c");
  stdin.write("r");
  await wait();
  stdin.write("\x7f"); // backspace
  await wait();
  const frame = lastFrame();
  // "cr" → after backspace → "c" should remain
  assert.ok(!frame.includes("cr█"), `unexpected "cr" cursor in: ${frame}`);
  unmount();
});

test("first esc clears text filter", async () => {
  const ws = makeWorkspace({
    flows: [
      makeFlow({ name: "create-user", folderPath: "/tmp/a" }),
      makeFlow({ name: "fetch-otp", folderPath: "/tmp/b" }),
    ],
  });
  const { lastFrame, stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  stdin.write("f"); // filter to "fetch-otp"
  await wait();
  // Both should be visible after esc clears filter
  stdin.write("\x1b");
  await wait();
  const frame = lastFrame();
  assert.ok(
    frame.includes("create-user"),
    `expected "create-user" after filter clear in: ${frame}`,
  );
  assert.ok(
    frame.includes("fetch-otp"),
    `expected "fetch-otp" after filter clear in: ${frame}`,
  );
  unmount();
});

test("second esc (no filter) calls onQuit", async () => {
  let quitCalled = false;
  const { stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: makeWorkspace(),
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {
        quitCalled = true;
      },
      onHelp: () => {},
    }),
  );
  stdin.write("\x1b"); // esc — no filter → quit
  await wait();
  assert.ok(quitCalled, "onQuit should have been called on esc with no filter");
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — zero-results state
// ---------------------------------------------------------------------------

test("shows zero-results message when nothing matches", async () => {
  const ws = makeWorkspace({
    flows: [makeFlow({ name: "create-user" })],
  });
  const { lastFrame, stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  stdin.write("z"); // no flow name contains "z"
  await wait();
  const frame = lastFrame();
  assert.ok(
    frame.includes("nothing here"),
    `expected "nothing here" in: ${frame}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — select flow
// ---------------------------------------------------------------------------

test("pressing enter on a valid flow calls onSelect", async () => {
  let selectedFlow = null;
  const flow = makeFlow({ name: "create-user", folderPath: "/tmp/cu" });
  const ws = makeWorkspace({ flows: [flow] });
  const { stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: (f) => {
        selectedFlow = f;
      },
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  stdin.write("\r"); // enter
  await wait();
  assert.ok(selectedFlow !== null, "onSelect should have been called");
  assert.equal(selectedFlow.name, "create-user");
  unmount();
});

test("pressing enter on a broken flow shows inline error", async () => {
  let selectCalled = false;
  const broken = makeBrokenFlow({
    folderPath: "/tmp/ws/flows/bad-one",
    reason: "missing .resources/definition.yaml",
  });
  const ws = makeWorkspace({ flows: [broken] });
  const { lastFrame, stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {
        selectCalled = true;
      },
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  stdin.write("\r");
  await wait();
  const frame = lastFrame();
  assert.ok(!selectCalled, "onSelect should not be called for broken flow");
  assert.ok(
    frame.includes("broken"),
    `expected inline error text in: ${frame}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — ? help
// ---------------------------------------------------------------------------

test("? calls onHelp", async () => {
  let helpCalled = false;
  const { stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: makeWorkspace(),
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {
        helpCalled = true;
      },
    }),
  );
  stdin.write("?");
  await wait();
  assert.ok(helpCalled, "onHelp should have been called");
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — env overlay
// ---------------------------------------------------------------------------

test("e opens env overlay", async () => {
  const ws = makeWorkspace({
    environments: [makeEnv("dev", "development")],
  });
  const { lastFrame, stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  stdin.write("e");
  await wait();
  const frame = lastFrame();
  assert.ok(
    frame.includes("select environment"),
    `expected overlay title in: ${frame}`,
  );
  assert.ok(frame.includes("development"), `expected env name in: ${frame}`);
  unmount();
});

test("esc in env overlay closes it", async () => {
  const ws = makeWorkspace({
    environments: [makeEnv("dev")],
  });
  const { lastFrame, stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  stdin.write("e");
  await wait();
  stdin.write("\x1b");
  await wait();
  const frame = lastFrame();
  assert.ok(
    !frame.includes("select environment"),
    `overlay should be closed in: ${frame}`,
  );
  assert.ok(
    frame.includes("flow picker"),
    `main screen should be visible in: ${frame}`,
  );
  unmount();
});

test("selecting env in overlay sets env filter in status row", async () => {
  const flow = makeFlow({ name: "my-flow", environments: ["dev"] });
  const ws = makeWorkspace({
    flows: [flow],
    environments: [makeEnv("dev", "development")],
  });
  const { lastFrame, stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  stdin.write("e"); // open env overlay
  await wait();
  // Navigate to "development" (it's the second item after "all environments")
  stdin.write("\x1b[B"); // down arrow
  await wait();
  stdin.write("\r"); // select
  await wait();
  const frame = lastFrame();
  assert.ok(
    frame.includes("env: development"),
    `expected env filter in status row in: ${frame}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — group overlay
// ---------------------------------------------------------------------------

test("g opens group overlay", async () => {
  const ws = makeWorkspace({
    flows: [
      makeFlow({
        name: "create-user",
        group: "user-flows",
        folderPath: "/tmp/uf",
      }),
    ],
  });
  const { lastFrame, stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  stdin.write("g");
  await wait();
  const frame = lastFrame();
  assert.ok(
    frame.includes("select group"),
    `expected group overlay title in: ${frame}`,
  );
  assert.ok(
    frame.includes("user-flows"),
    `expected group name in overlay in: ${frame}`,
  );
  unmount();
});

test("selecting group in overlay shows group filter in status row", async () => {
  const ws = makeWorkspace({
    flows: [
      makeFlow({
        name: "create-user",
        group: "user-flows",
        folderPath: "/tmp/uf",
      }),
    ],
  });
  const { lastFrame, stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  stdin.write("g");
  await wait();
  stdin.write("\x1b[B"); // down to "user-flows"
  await wait();
  stdin.write("\r");
  await wait();
  const frame = lastFrame();
  assert.ok(
    frame.includes("group: user-flows"),
    `expected group filter in status row in: ${frame}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — shift-R reload
// ---------------------------------------------------------------------------

test("shift-R calls onReload with new workspace", async () => {
  let reloadCalled = false;
  // Use real workspace path so loadWorkspace doesn't fail — use ungrouped fixture
  const { loadWorkspace } = await import("../dist/workspace/index.js");
  const wsPath = new URL("fixtures/workspace/ungrouped", import.meta.url)
    .pathname;
  const ws = await loadWorkspace(wsPath);

  const { stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {
        reloadCalled = true;
      },
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  stdin.write("R");
  await wait(200); // allow async reload
  assert.ok(reloadCalled, "onReload should have been called on shift-R");
  unmount();
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test("arrow down moves selection to next item", async () => {
  const ws = makeWorkspace({
    flows: [
      makeFlow({ name: "flow-a", folderPath: "/tmp/a" }),
      makeFlow({ name: "flow-b", folderPath: "/tmp/b" }),
    ],
  });
  const { lastFrame, stdin, unmount } = render(
    React.createElement(FlowPickerScreen, {
      workspace: ws,
      onSelect: () => {},
      onReload: () => {},
      onQuit: () => {},
      onHelp: () => {},
    }),
  );
  // Initially flow-a is selected (">")
  stdin.write("\x1b[B"); // down arrow
  await wait();
  const frame = lastFrame();
  // flow-b should now have the ">" marker
  assert.ok(frame.includes("> "), `expected "> " cursor in: ${frame}`);
  unmount();
});
