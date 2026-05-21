/**
 * HelpOverlay component tests.
 * Run via: npm test (tsc first, then node --test)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render } from "ink-testing-library";
import { HelpOverlay } from "../dist/ui/screens/HelpOverlay.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProps(overrides = {}) {
  return {
    onClose: () => {},
    onChangeWorkspace: () => {},
    onQuit: () => {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

test("HelpOverlay: renders title 'help'", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(HelpOverlay, makeProps()),
  );
  assert.ok(lastFrame().includes("help"), `got: ${lastFrame()}`);
  unmount();
});

test("HelpOverlay: renders 'actions' section header", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(HelpOverlay, makeProps()),
  );
  assert.ok(lastFrame().includes("actions"), `got: ${lastFrame()}`);
  unmount();
});

test("HelpOverlay: renders all four actions", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(HelpOverlay, makeProps()),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("change workspace"), `got: ${frame}`);
  assert.ok(frame.includes("show log directory"), `got: ${frame}`);
  assert.ok(frame.includes("show workspace path"), `got: ${frame}`);
  assert.ok(frame.includes("quit"), `got: ${frame}`);
  unmount();
});

test("HelpOverlay: renders 'keys' section when keys prop provided", async () => {
  const keys = [
    { key: "↑↓", description: "navigate" },
    { key: "enter", description: "select" },
  ];
  const { lastFrame, unmount } = render(
    React.createElement(HelpOverlay, makeProps({ keys })),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("keys"), `got: ${frame}`);
  assert.ok(frame.includes("navigate"), `got: ${frame}`);
  assert.ok(frame.includes("select"), `got: ${frame}`);
  unmount();
});

test("HelpOverlay: hides keys section when keys prop is empty", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(HelpOverlay, makeProps({ keys: [] })),
  );
  // Should NOT render the 'keys' section header
  assert.ok(!lastFrame().includes("keys"), `unexpected "keys" in: ${lastFrame()}`);
  unmount();
});

test("HelpOverlay: renders footer nav hint by default", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(HelpOverlay, makeProps()),
  );
  assert.ok(lastFrame().includes("↑↓ nav"), `got: ${lastFrame()}`);
  unmount();
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test("HelpOverlay: ↓ moves selection to second action", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(HelpOverlay, makeProps()),
  );
  stdin.write("\x1b[B"); // down arrow
  await new Promise((r) => setTimeout(r, 50));
  const frame = lastFrame();
  // Second action "show log directory" should now be selected (prefixed with >)
  assert.ok(
    frame.includes("> show log directory"),
    `expected "> show log directory" in: ${frame}`,
  );
  unmount();
});

test("HelpOverlay: ↑ does not go below index 0", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(HelpOverlay, makeProps()),
  );
  stdin.write("\x1b[A"); // up arrow — already at 0
  await new Promise((r) => setTimeout(r, 50));
  const frame = lastFrame();
  assert.ok(
    frame.includes("> change workspace"),
    `expected "> change workspace" in: ${frame}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

test("HelpOverlay: enter on 'change workspace' calls onChangeWorkspace", async () => {
  let called = false;
  const { stdin, unmount } = render(
    React.createElement(
      HelpOverlay,
      makeProps({ onChangeWorkspace: () => { called = true; } }),
    ),
  );
  // index 0 is "change workspace" — press enter
  stdin.write("\r");
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(called, "onChangeWorkspace should have been called");
  unmount();
});

test("HelpOverlay: enter on 'quit' calls onQuit", async () => {
  let called = false;
  const { stdin, unmount } = render(
    React.createElement(
      HelpOverlay,
      makeProps({ onQuit: () => { called = true; } }),
    ),
  );
  // Navigate to index 3 "quit"
  stdin.write("\x1b[B"); // down
  await new Promise((r) => setTimeout(r, 20));
  stdin.write("\x1b[B"); // down
  await new Promise((r) => setTimeout(r, 20));
  stdin.write("\x1b[B"); // down → now on "quit"
  await new Promise((r) => setTimeout(r, 20));
  stdin.write("\r"); // enter
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(called, "onQuit should have been called");
  unmount();
});

test("HelpOverlay: enter on 'show log directory' shows logDir in footer", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(
      HelpOverlay,
      makeProps({ logDir: "/tmp/test-logs" }),
    ),
  );
  // Navigate to index 1 "show log directory"
  stdin.write("\x1b[B"); // down
  await new Promise((r) => setTimeout(r, 20));
  stdin.write("\r"); // enter
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(
    lastFrame().includes("/tmp/test-logs"),
    `expected log dir in footer; got: ${lastFrame()}`,
  );
  unmount();
});

test("HelpOverlay: enter on 'show workspace path' shows workspacePath in footer", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(
      HelpOverlay,
      makeProps({ workspacePath: "/home/user/my-workspace" }),
    ),
  );
  // Navigate to index 2 "show workspace path"
  stdin.write("\x1b[B"); // down
  await new Promise((r) => setTimeout(r, 20));
  stdin.write("\x1b[B"); // down
  await new Promise((r) => setTimeout(r, 20));
  stdin.write("\r"); // enter
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(
    lastFrame().includes("/home/user/my-workspace"),
    `expected workspace path in footer; got: ${lastFrame()}`,
  );
  unmount();
});

test("HelpOverlay: 'show workspace path' with no path shows fallback", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(HelpOverlay, makeProps({ workspacePath: undefined })),
  );
  stdin.write("\x1b[B"); // down
  await new Promise((r) => setTimeout(r, 20));
  stdin.write("\x1b[B"); // down → "show workspace path"
  await new Promise((r) => setTimeout(r, 20));
  stdin.write("\r"); // enter
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(
    lastFrame().includes("no workspace configured"),
    `expected fallback text; got: ${lastFrame()}`,
  );
  unmount();
});
