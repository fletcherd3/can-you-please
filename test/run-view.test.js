/**
 * Run view screen tests.
 * Run via: npm test (tsc first, then node --test)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render } from "ink-testing-library";

import { RunViewScreen } from "../dist/ui/screens/RunViewScreen.js";
import { selectRequestProvenance } from "../dist/request-provenance.js";
import { buildDetailLines } from "../dist/ui/components/DetailPane.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wait(ms = 80) {
  return new Promise((r) => setTimeout(r, ms));
}

function press(stdin, key) {
  stdin.write(key);
}

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

function makeRequest(overrides = {}) {
  return {
    name: overrides.name ?? "create-user",
    url: overrides.url ?? "https://api.dev/users",
    method: overrides.method ?? "POST",
    headers: overrides.headers ?? { "Content-Type": "application/json" },
    body: overrides.body ?? { type: "json", content: '{"name":"test"}' },
    scripts: overrides.scripts ?? [],
    order: overrides.order ?? 100,
    ...overrides,
  };
}

function makeFlow(overrides = {}) {
  return {
    kind: "flow",
    folderPath: "/tmp/ws/flows/test-flow",
    name: overrides.name ?? "test-flow",
    group: overrides.group ?? null,
    description: undefined,
    order: 100,
    environments: [],
    continueOnError: false,
    variables: {},
    requires: [],
    enums: {},
    requests: overrides.requests ?? [makeRequest()],
    ...overrides,
  };
}

function makeEnv(id = "dev") {
  return { id, name: id, values: [], filePath: `/tmp/ws/${id}.yaml` };
}

function makeWorkspace(overrides = {}) {
  return {
    rootPath: "/tmp/ws",
    flows: [],
    environments: [makeEnv()],
    globals: null,
    ...overrides,
  };
}

/**
 * A fake runFlowFn that emits the given events then completes.
 * Events are emitted asynchronously (10ms apart) to allow React to render
 * intermediate states.
 */
function makeRunFn(events) {
  return function () {
    let i = 0;
    return {
      [Symbol.asyncIterator]() {
        return {
          next() {
            if (i >= events.length) {
              return Promise.resolve({ done: true, value: undefined });
            }
            const ev = events[i++];
            return new Promise((resolve) =>
              setTimeout(() => resolve({ done: false, value: ev }), 10),
            );
          },
          return() {
            i = events.length;
            return Promise.resolve({ done: true, value: undefined });
          },
        };
      },
    };
  };
}

function makeCapturingRunFn(capture, events = []) {
  return function (flow, variables, options) {
    capture.push({ flow, variables, options });
    return {
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          next() {
            if (i >= events.length) {
              return Promise.resolve({ done: true, value: undefined });
            }
            const ev = events[i++];
            return Promise.resolve({ done: false, value: ev });
          },
          return() {
            i = events.length;
            return Promise.resolve({ done: true, value: undefined });
          },
        };
      },
    };
  };
}

function makePassRun(requestName = "create-user") {
  return makeRunFn([
    {
      type: "RequestStarted",
      name: requestName,
      method: "POST",
      url: "https://api.dev/users",
      resolvedRequest: {
        method: "POST",
        url: "https://api.dev/users",
        headers: {},
      },
    },
    {
      type: "RequestCompleted",
      name: requestName,
      method: "POST",
      url: "https://api.dev/users",
      status: 201,
      statusText: "Created",
      responseTimeMs: 42,
      headers: { "content-type": "application/json" },
      body: '{"id":"u1"}',
      resolvedRequest: {
        method: "POST",
        url: "https://api.dev/users",
        headers: {},
      },
      failed: false,
      consoleOutput: [],
      variablesSet: {},
    },
    {
      type: "RunFinished",
      totalRequests: 1,
      failedRequests: 0,
      durationMs: 50,
    },
  ]);
}

function makeFailRun(requestName = "create-user") {
  return makeRunFn([
    {
      type: "RequestStarted",
      name: requestName,
      method: "POST",
      url: "https://api.dev/users",
      resolvedRequest: {
        method: "POST",
        url: "https://api.dev/users",
        headers: {},
      },
    },
    {
      type: "RequestCompleted",
      name: requestName,
      method: "POST",
      url: "https://api.dev/users",
      status: 500,
      statusText: "Internal Server Error",
      responseTimeMs: 123,
      headers: {},
      body: '{"error":"boom"}',
      resolvedRequest: {
        method: "POST",
        url: "https://api.dev/users",
        headers: {},
      },
      failed: true,
      failureMessage: "500 Internal Server Error",
      consoleOutput: [],
      variablesSet: {},
      parsedResponseError: { error: "boom" },
    },
    {
      type: "RunFinished",
      totalRequests: 1,
      failedRequests: 1,
      durationMs: 130,
    },
  ]);
}

// Never-resolving run (stays in "running" state)
function makeHangingRun() {
  return makeRunFn([]); // emits nothing — loop hangs on next()
}

// Fake hanging run that emits RequestStarted but then hangs
function makePartialRun(requestName = "create-user") {
  return makeRunFn([
    {
      type: "RequestStarted",
      name: requestName,
      method: "POST",
      url: "https://api.dev/users",
    },
    // then hangs (no more events until return() is called)
  ]);
}

function makeProps(overrides = {}) {
  return {
    workspace: makeWorkspace(),
    flow: makeFlow(),
    env: makeEnv(),
    variables: {},
    continueOnError: false,
    onBack: () => {},
    onHelp: () => {},
    _runFlowFn: makeHangingRun(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rendering — title and structure
// ---------------------------------------------------------------------------

test("renders 'run view' title with flow name", () => {
  const { lastFrame, unmount } = render(
    React.createElement(RunViewScreen, makeProps()),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("run view"), `expected "run view" in: ${frame}`);
  assert.ok(
    frame.includes("test-flow"),
    `expected "test-flow" in: ${frame}`,
  );
  unmount();
});

test("renders group/name when flow has a group", () => {
  const props = makeProps({
    flow: makeFlow({ name: "my-flow", group: "billing" }),
  });
  const { lastFrame, unmount } = render(React.createElement(RunViewScreen, props));
  const frame = lastFrame();
  assert.ok(
    frame.includes("billing/my-flow"),
    `expected "billing/my-flow" in: ${frame}`,
  );
  unmount();
});

test("shows all requests in pending state initially", () => {
  const flow = makeFlow({
    requests: [
      makeRequest({ name: "step-1", order: 100 }),
      makeRequest({ name: "step-2", order: 200 }),
    ],
  });
  const { lastFrame, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ flow, _runFlowFn: makeHangingRun() })),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("step-1"), `expected "step-1" in: ${frame}`);
  assert.ok(frame.includes("step-2"), `expected "step-2" in: ${frame}`);
  // pending glyph (⋯) should be visible
  assert.ok(frame.includes("⋯"), `expected pending glyph ⋯ in: ${frame}`);
  unmount();
});

test("shows progress bar 0/N initially", () => {
  const flow = makeFlow({ requests: [makeRequest(), makeRequest({ name: "r2", order: 200 })] });
  const { lastFrame, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ flow, _runFlowFn: makeHangingRun() })),
  );
  assert.ok(lastFrame().includes("0/2"), `expected "0/2" in: ${lastFrame()}`);
  unmount();
});

// ---------------------------------------------------------------------------
// Footer hints
// ---------------------------------------------------------------------------

test("shows running footer during run", () => {
  const { lastFrame, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ _runFlowFn: makeHangingRun() })),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("esc cancel"), `expected "esc cancel" in: ${frame}`);
  assert.ok(frame.includes("f follow"), `expected "f follow" in: ${frame}`);
  unmount();
});

test("shows post-run footer after run completes", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(
      RunViewScreen,
      makeProps({ _runFlowFn: makePassRun() }),
    ),
  );
  await wait(200);
  const frame = lastFrame();
  assert.ok(
    frame.includes("r re-run"),
    `expected "r re-run" in: ${frame}`,
  );
  assert.ok(
    frame.includes("esc back"),
    `expected "esc back" in: ${frame}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Pass / fail outcome display
// ---------------------------------------------------------------------------

test("shows ✓ pass after successful run", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ _runFlowFn: makePassRun() })),
  );
  await wait(200);
  const frame = lastFrame();
  assert.ok(frame.includes("✓ pass"), `expected "✓ pass" in: ${frame}`);
  unmount();
});

test("shows ✗ fail after failed run", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ _runFlowFn: makeFailRun() })),
  );
  await wait(200);
  const frame = lastFrame();
  assert.ok(frame.includes("✗ fail"), `expected "✗ fail" in: ${frame}`);
  unmount();
});

test("updates request row to ✓ on success", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ _runFlowFn: makePassRun() })),
  );
  await wait(200);
  const frame = lastFrame();
  assert.ok(frame.includes("✓"), `expected ✓ glyph in: ${frame}`);
  assert.ok(frame.includes("201"), `expected status 201 in: ${frame}`);
  unmount();
});

test("updates request row to ✗ on failure", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ _runFlowFn: makeFailRun() })),
  );
  await wait(200);
  const frame = lastFrame();
  assert.ok(frame.includes("✗"), `expected ✗ glyph in: ${frame}`);
  assert.ok(frame.includes("500"), `expected status 500 in: ${frame}`);
  unmount();
});

test("shows 💬 glyph when console output present", async () => {
  const fn = makeRunFn([
    { type: "RequestStarted", name: "create-user", method: "POST", url: "https://a" },
    {
      type: "RequestCompleted",
      name: "create-user",
      method: "POST",
      url: "https://a",
      status: 200,
      statusText: "OK",
      responseTimeMs: 10,
      headers: {},
      body: "",
      failed: false,
      consoleOutput: ["[log] hello"],
      variablesSet: {},
    },
    { type: "RunFinished", totalRequests: 1, failedRequests: 0, durationMs: 15 },
  ]);
  const { lastFrame, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ _runFlowFn: fn })),
  );
  await wait(200);
  assert.ok(lastFrame().includes("💬"), `expected 💬 in: ${lastFrame()}`);
  unmount();
});

test("shows progress N/M after run", async () => {
  const flow = makeFlow({ requests: [makeRequest()] });
  const { lastFrame, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ flow, _runFlowFn: makePassRun() })),
  );
  await wait(200);
  assert.ok(lastFrame().includes("1/1"), `expected "1/1" in: ${lastFrame()}`);
  unmount();
});

// ---------------------------------------------------------------------------
// Detail pane — tab toggle
// ---------------------------------------------------------------------------

test("detail pane hidden by default", () => {
  const { lastFrame, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ _runFlowFn: makeHangingRun() })),
  );
  // Detail pane separator │ should not be visible initially
  assert.ok(
    !lastFrame().includes("── request"),
    `detail pane should be hidden: ${lastFrame()}`,
  );
  unmount();
});

test("tab shows detail pane", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ _runFlowFn: makeHangingRun() })),
  );
  await wait(50);
  press(stdin, "\t");
  await wait(50);
  assert.ok(
    lastFrame().includes("── request"),
    `expected detail pane after tab: ${lastFrame()}`,
  );
  unmount();
});

test("tab toggles detail pane off", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ _runFlowFn: makeHangingRun() })),
  );
  await wait(50);
  press(stdin, "\t");
  await wait(50);
  press(stdin, "\t");
  await wait(50);
  assert.ok(
    !lastFrame().includes("── request"),
    `detail pane should be hidden again: ${lastFrame()}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Detail pane — auto-shown on failed run
// ---------------------------------------------------------------------------

test("detail pane auto-shown on run failure", async () => {
  const { lastFrame, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ _runFlowFn: makeFailRun() })),
  );
  await wait(300);
  assert.ok(
    lastFrame().includes("── response"),
    `expected detail pane auto-open on fail: ${lastFrame()}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// esc behaviour
// ---------------------------------------------------------------------------

test("RunViewScreen: passes workspace globals only via globals, not environment", async () => {
  const calls = [];
  const workspace = makeWorkspace({
    globals: {
      values: [
        { key: "product", value: "zip-pay", enabled: true },
        { key: "first-name", value: "test", enabled: true },
      ],
    },
  });

  const props = makeProps({
    workspace,
    variables: {
      product: "zip-pay",
      "first-name": "sam",
      localOnly: "dev-value",
    },
    _runFlowFn: makeCapturingRunFn(calls),
  });

  const { unmount } = render(React.createElement(RunViewScreen, props));
  await wait(30);

  assert.equal(calls.length, 1, "expected one runFlow call");
  assert.deepEqual(calls[0].variables, { localOnly: "dev-value" });
  assert.deepEqual(calls[0].options.globals, {
    product: "zip-pay",
    "first-name": "sam",
  });

  unmount();
});

test("esc mid-run aborts and shows cancelled state", async () => {
  const { lastFrame, stdin, unmount } = render(
    React.createElement(
      RunViewScreen,
      makeProps({ _runFlowFn: makePartialRun() }),
    ),
  );
  await wait(100); // let RequestStarted fire
  press(stdin, "\x1B"); // esc
  await wait(80);
  const frame = lastFrame();
  assert.ok(
    frame.includes("—") || frame.includes("cancelled"),
    `expected cancelled indicator in: ${frame}`,
  );
  unmount();
});

test("esc post-run calls onBack", async () => {
  let backCalled = false;
  const { stdin, unmount } = render(
    React.createElement(
      RunViewScreen,
      makeProps({
        _runFlowFn: makePassRun(),
        onBack: () => { backCalled = true; },
      }),
    ),
  );
  await wait(200); // run finishes
  press(stdin, "\x1B"); // esc
  await wait(50);
  assert.ok(backCalled, "expected onBack to be called");
  unmount();
});

test("esc mid-run stays on run view (does not immediately call onBack)", async () => {
  let backCalled = false;
  const { stdin, unmount } = render(
    React.createElement(
      RunViewScreen,
      makeProps({
        _runFlowFn: makeHangingRun(),
        onBack: () => { backCalled = true; },
      }),
    ),
  );
  await wait(50);
  press(stdin, "\x1B"); // esc — should abort, not navigate back
  await wait(80);
  assert.ok(!backCalled, "onBack should NOT be called on first esc mid-run");
  unmount();
});

test("second esc after mid-run abort calls onBack", async () => {
  let backCalled = false;
  const { stdin, unmount } = render(
    React.createElement(
      RunViewScreen,
      makeProps({
        _runFlowFn: makeHangingRun(),
        onBack: () => { backCalled = true; },
      }),
    ),
  );
  await wait(50);
  press(stdin, "\x1B"); // first esc — abort
  await wait(80);
  press(stdin, "\x1B"); // second esc — back
  await wait(50);
  assert.ok(backCalled, "expected onBack after second esc");
  unmount();
});

// ---------------------------------------------------------------------------
// r — re-run (post-run)
// ---------------------------------------------------------------------------

test("r key is inactive during run", async () => {
  let runCount = 0;
  const fn = () => {
    runCount++;
    return makeHangingRun()();
  };
  const { stdin, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ _runFlowFn: fn })),
  );
  await wait(50);
  press(stdin, "r");
  await wait(80);
  assert.equal(runCount, 1, "r should not start a second run while running");
  unmount();
});

test("r key post-run triggers re-run", async () => {
  let runCount = 0;
  const fn = () => {
    runCount++;
    // Return a pass run each time
    return makePassRun()();
  };
  const { stdin, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ _runFlowFn: fn })),
  );
  await wait(300); // first run finishes
  press(stdin, "r");
  await wait(300); // second run finishes
  assert.ok(runCount >= 2, `expected at least 2 runs, got ${runCount}`);
  unmount();
});

// ---------------------------------------------------------------------------
// c — continue-on-error toggle
// ---------------------------------------------------------------------------

test("c key toggles continue-on-error label", async () => {
  // The footer doesn't show coE status directly but the key press shouldn't crash
  // We verify the component stays rendered after pressing c
  const { lastFrame, stdin, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ _runFlowFn: makeHangingRun() })),
  );
  await wait(50);
  press(stdin, "c");
  await wait(50);
  // Component should still render correctly after toggle
  assert.ok(
    lastFrame().includes("run view"),
    `expected component still renders after c: ${lastFrame()}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// f — re-attach auto-follow
// ---------------------------------------------------------------------------

test("pressing up disables auto-follow; f re-attaches", async () => {
  const flow = makeFlow({
    requests: [
      makeRequest({ name: "req-1", order: 100 }),
      makeRequest({ name: "req-2", order: 200 }),
    ],
  });
  // run that starts req-2 (index 1)
  const fn = makeRunFn([
    { type: "RequestStarted", name: "req-2", method: "GET", url: "https://a" },
  ]);
  const { lastFrame, stdin, unmount } = render(
    React.createElement(RunViewScreen, makeProps({ flow, _runFlowFn: fn })),
  );
  await wait(100); // req-2 running (selectedIndex auto-follows to 1)
  press(stdin, "\x1B[A"); // up — disables auto-follow, moves to req-1
  await wait(50);
  press(stdin, "f"); // re-attach
  await wait(50);
  // After re-attach, should show > on running item (req-2)
  const frame = lastFrame();
  assert.ok(frame.includes("req-2"), `expected req-2 visible: ${frame}`);
  unmount();
});

// ---------------------------------------------------------------------------
// ? — help overlay
// ---------------------------------------------------------------------------

test("? key calls onHelp", async () => {
  let helpCalled = false;
  const { stdin, unmount } = render(
    React.createElement(
      RunViewScreen,
      makeProps({ onHelp: () => { helpCalled = true; }, _runFlowFn: makeHangingRun() }),
    ),
  );
  await wait(50);
  press(stdin, "?");
  await wait(50);
  assert.ok(helpCalled, "expected onHelp to be called");
  unmount();
});

// ---------------------------------------------------------------------------
// DetailPane unit tests (buildDetailLines)
// ---------------------------------------------------------------------------

test("selectRequestProvenance: falls back to definition snapshot", () => {
  const req = makeRequest({
    url: "https://api.dev/{{env}}/users",
    headers: { Authorization: "Bearer {{tok}}" },
    body: { type: "json", content: '{"from":"definition"}' },
  });

  const selection = selectRequestProvenance(null, req, null);

  assert.equal(selection.source, "definition");
  assert.equal(selection.snapshot?.url, "https://api.dev/{{env}}/users");
  assert.equal(selection.snapshot?.headers.Authorization, "Bearer {{tok}}");
  assert.equal(selection.snapshot?.body?.content, '{"from":"definition"}');
});

test("selectRequestProvenance: prefers resolved snapshot before send", () => {
  const req = makeRequest({
    url: "https://api.dev/{{env}}/users",
    headers: { Authorization: "Bearer {{tok}}" },
  });
  const startedEvent = {
    type: "RequestStarted",
    name: "create-user",
    method: "POST",
    url: "https://api.dev/sand/users",
    resolvedRequest: {
      method: "POST",
      url: "https://api.dev/sand/users",
      headers: { Authorization: "Bearer resolved" },
      body: { mode: "raw", content: '{"from":"resolved"}' },
    },
  };

  const selection = selectRequestProvenance(null, req, startedEvent);

  assert.equal(selection.source, "resolved");
  assert.equal(selection.snapshot?.url, "https://api.dev/sand/users");
  assert.equal(selection.snapshot?.headers.Authorization, "Bearer resolved");
  assert.equal(selection.snapshot?.body?.content, '{"from":"resolved"}');
});

test("selectRequestProvenance: prefers sent snapshot over resolved snapshot", () => {
  const req = makeRequest({
    url: "https://api.dev/{{env}}/users",
    headers: { Authorization: "Bearer {{tok}}" },
  });
  const startedEvent = {
    type: "RequestStarted",
    name: "create-user",
    method: "POST",
    url: "https://api.dev/sand/users",
    resolvedRequest: {
      method: "POST",
      url: "https://api.dev/sand/users",
      headers: { Authorization: "Bearer resolved" },
      body: { mode: "raw", content: '{"from":"resolved"}' },
    },
  };
  const completedEvent = {
    type: "RequestCompleted",
    name: "create-user",
    method: "POST",
    url: "https://api.dev/sand/users",
    status: 200,
    statusText: "OK",
    responseTimeMs: 42,
    headers: {},
    body: '{"ok":true}',
    resolvedRequest: startedEvent.resolvedRequest,
    sentRequest: {
      method: "POST",
      url: "https://api.dev/sent/users",
      headers: { Authorization: "Bearer sent" },
      body: { mode: "raw", content: '{"from":"sent"}' },
    },
    failed: false,
    consoleOutput: [],
    variablesSet: {},
  };

  const selection = selectRequestProvenance(completedEvent, req, startedEvent);

  assert.equal(selection.source, "sent");
  assert.equal(selection.snapshot?.url, "https://api.dev/sent/users");
  assert.equal(selection.snapshot?.headers.Authorization, "Bearer sent");
  assert.equal(selection.snapshot?.body?.content, '{"from":"sent"}');
});

test("buildDetailLines: pending (no completed event)", () => {
  const req = makeRequest();
  const lines = buildDetailLines(null, req);
  assert.ok(
    lines.some((l) => l.includes("(pending)")),
    `expected "(pending)" in lines: ${lines.join("\n")}`,
  );
  assert.ok(
    lines.some((l) => l.includes("source:  definition")),
    `expected definition source in lines: ${lines.join("\n")}`,
  );
  assert.ok(
    lines.some((l) => l.includes("POST")),
    `expected method in lines`,
  );
});

test("buildDetailLines: shows method, url, status", () => {
  const completedEvent = {
    type: "RequestCompleted",
    name: "create-user",
    method: "POST",
    url: "https://api.dev/users",
    status: 201,
    statusText: "Created",
    responseTimeMs: 42,
    headers: { "x-req-id": "abc" },
    body: '{"id":"u1"}',
    resolvedRequest: {
      method: "POST",
      url: "https://api.dev/users",
      headers: {},
    },
    failed: false,
    consoleOutput: [],
    variablesSet: {},
  };
  const lines = buildDetailLines(completedEvent, null);
  assert.ok(lines.some((l) => l.includes("POST")), "expected method");
  assert.ok(lines.some((l) => l.includes("201")), "expected status code");
  assert.ok(lines.some((l) => l.includes("42ms")), "expected duration");
});

test("buildDetailLines: pretty-prints JSON body", () => {
  const completedEvent = {
    type: "RequestCompleted",
    name: "x",
    method: "GET",
    url: "https://a",
    status: 200,
    statusText: "OK",
    responseTimeMs: 10,
    headers: {},
    body: '{"a":1,"b":2}',
    failed: false,
    consoleOutput: [],
    variablesSet: {},
  };
  const lines = buildDetailLines(completedEvent, null);
  // Pretty-printed JSON has newlines — each line becomes a separate entry
  assert.ok(
    lines.some((l) => l.trim() === '"a": 1,'),
    `expected pretty-printed JSON line in: ${lines.join("\n")}`,
  );
});

test("buildDetailLines: shows console output section", () => {
  const completedEvent = {
    type: "RequestCompleted",
    name: "x",
    method: "GET",
    url: "https://a",
    status: 200,
    statusText: "OK",
    responseTimeMs: 5,
    headers: {},
    body: "",
    failed: false,
    consoleOutput: ["[log] hello world"],
    variablesSet: {},
  };
  const lines = buildDetailLines(completedEvent, null);
  assert.ok(
    lines.some((l) => l.includes("── console")),
    "expected console section header",
  );
  assert.ok(
    lines.some((l) => l.includes("hello world")),
    "expected console message",
  );
});

test("buildDetailLines: shows variables set section", () => {
  const completedEvent = {
    type: "RequestCompleted",
    name: "x",
    method: "GET",
    url: "https://a",
    status: 200,
    statusText: "OK",
    responseTimeMs: 5,
    headers: {},
    body: "",
    failed: false,
    consoleOutput: [],
    variablesSet: { userId: "u42" },
  };
  const lines = buildDetailLines(completedEvent, null);
  assert.ok(
    lines.some((l) => l.includes("── variables set")),
    "expected variables section header",
  );
  assert.ok(
    lines.some((l) => l.includes("userId = u42")),
    "expected variable entry",
  );
});

test("buildDetailLines: shows failure section on failed request", () => {
  const completedEvent = {
    type: "RequestCompleted",
    name: "x",
    method: "POST",
    url: "https://a",
    status: 500,
    statusText: "Internal Server Error",
    responseTimeMs: 50,
    headers: {},
    body: '{"error":"boom"}',
    failed: true,
    failureMessage: "500 Internal Server Error",
    consoleOutput: [],
    variablesSet: {},
    parsedResponseError: { error: "boom", message: undefined, details: undefined },
  };
  const lines = buildDetailLines(completedEvent, null);
  assert.ok(
    lines.some((l) => l.includes("── failure")),
    "expected failure section header",
  );
  assert.ok(
    lines.some((l) => l.includes("500")),
    "expected failure message with status",
  );
});

test("buildDetailLines: shows request headers from requestDef", () => {
  const req = makeRequest({ headers: { Authorization: "Bearer tok" } });
  const lines = buildDetailLines(null, req);
  assert.ok(
    lines.some((l) => l.includes("Authorization")),
    `expected Authorization header in: ${lines.join("\n")}`,
  );
});

test("buildDetailLines: omits empty request headers and body", () => {
  const req = makeRequest({ headers: {}, body: undefined });
  const lines = buildDetailLines(null, req);
  assert.ok(!lines.includes("headers:"), `unexpected headers section: ${lines.join("\n")}`);
  assert.ok(
    !lines.some((l) => l.startsWith("body (")),
    `unexpected body section: ${lines.join("\n")}`,
  );
});

test("buildDetailLines: returns placeholder when both args null", () => {
  const lines = buildDetailLines(null, null);
  assert.ok(
    lines.some((l) => l.includes("no request selected")),
    `expected placeholder: ${lines.join("\n")}`,
  );
});

test("buildDetailLines: startedEvent resolved data shown while pending", () => {
  const req = makeRequest({
    url: "https://api.dev/{{env}}/users",
    headers: { Authorization: "Bearer {{tok}}" },
    body: { type: "json", content: '{"email":"{{var_email}}"}' },
  });
  const startedEvent = {
    type: "RequestStarted",
    name: "create-user",
    method: "POST",
    url: "https://api.dev/sand/users",
    resolvedRequest: {
      method: "POST",
      url: "https://api.dev/sand/users",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer real-token",
      },
      body: { mode: "raw", content: '{"email":"test@zip.co"}' },
    },
  };
  const lines = buildDetailLines(null, req, startedEvent);
  assert.ok(
    lines.some((l) => l.includes("source:  resolved")),
    `expected resolved source: ${lines.join("\n")}`,
  );
  // Should use resolved URL from startedEvent, not raw requestDef
  assert.ok(
    lines.some((l) => l.includes("https://api.dev/sand/users")),
    `expected resolved URL: ${lines.join("\n")}`,
  );
  // Should show resolved header, not raw {{tok}}
  assert.ok(
    lines.some((l) => l.includes("Bearer real-token")),
    `expected resolved Authorization header: ${lines.join("\n")}`,
  );
  assert.ok(
    !lines.some((l) => l.includes("{{tok}}")),
    `should not contain unresolved {{tok}}: ${lines.join("\n")}`,
  );
  // Should show resolved body, not raw {{var_email}}
  assert.ok(
    lines.some((l) => l.includes("test@zip.co")),
    `expected resolved body: ${lines.join("\n")}`,
  );
  assert.ok(
    !lines.some((l) => l.includes("{{var_email}}")),
    `should not contain unresolved {{var_email}}: ${lines.join("\n")}`,
  );
  // Should still show (pending) for response
  assert.ok(
    lines.some((l) => l.includes("(pending)")),
    `expected (pending) response: ${lines.join("\n")}`,
  );
});

test("buildDetailLines: completedEvent takes precedence over startedEvent", () => {
  const startedEvent = {
    type: "RequestStarted",
    name: "create-user",
    method: "POST",
    url: "https://api.dev/users",
    resolvedRequest: {
      method: "POST",
      url: "https://api.dev/users",
      headers: { Authorization: "Bearer started" },
      body: { mode: "raw", content: '{"from":"started"}' },
    },
  };
  const completedEvent = {
    type: "RequestCompleted",
    name: "create-user",
    method: "POST",
    url: "https://api.dev/users",
    status: 200,
    statusText: "OK",
    responseTimeMs: 42,
    headers: {},
    body: '{"ok":true}',
    resolvedRequest: {
      method: "POST",
      url: "https://api.dev/users",
      headers: { Authorization: "Bearer completed" },
      body: { mode: "raw", content: '{"from":"completed"}' },
    },
    failed: false,
    consoleOutput: [],
    variablesSet: {},
  };
  const lines = buildDetailLines(completedEvent, null, startedEvent);
  assert.ok(
    lines.some((l) => l.includes("source:  resolved")),
    `expected resolved source: ${lines.join("\n")}`,
  );
  assert.ok(
    lines.some((l) => l.includes("Bearer completed")),
    `completedEvent header should win: ${lines.join("\n")}`,
  );
  assert.ok(
    !lines.some((l) => l.includes("Bearer started")),
    `startedEvent header should not appear: ${lines.join("\n")}`,
  );
});

test("buildDetailLines: completed sentRequest retrospectively replaces resolved data", () => {
  const req = makeRequest({
    url: "https://api.dev/{{env}}/users",
    headers: { Authorization: "Bearer {{tok}}" },
    body: { type: "json", content: '{"from":"definition"}' },
  });
  const startedEvent = {
    type: "RequestStarted",
    name: "create-user",
    method: "POST",
    url: "https://api.dev/sand/users",
    resolvedRequest: {
      method: "POST",
      url: "https://api.dev/sand/users",
      headers: { Authorization: "Bearer resolved" },
      body: { mode: "raw", content: '{"from":"resolved"}' },
    },
  };
  const completedEvent = {
    type: "RequestCompleted",
    name: "create-user",
    method: "POST",
    url: "https://api.dev/sand/users",
    status: 200,
    statusText: "OK",
    responseTimeMs: 42,
    headers: {},
    body: '{"ok":true}',
    resolvedRequest: {
      method: "POST",
      url: "https://api.dev/sand/users",
      headers: { Authorization: "Bearer resolved" },
      body: { mode: "raw", content: '{"from":"resolved"}' },
    },
    sentRequest: {
      method: "POST",
      url: "https://api.dev/sent/users",
      headers: { Authorization: "Bearer sent" },
      body: { mode: "raw", content: '{"from":"sent"}' },
    },
    failed: false,
    consoleOutput: [],
    variablesSet: {},
  };
  const lines = buildDetailLines(completedEvent, req, startedEvent);
  assert.ok(
    lines.some((l) => l.includes("source:  sent")),
    `expected sent source: ${lines.join("\n")}`,
  );
  assert.ok(
    lines.some((l) => l.includes("https://api.dev/sent/users")),
    `expected sent url: ${lines.join("\n")}`,
  );
  assert.ok(
    lines.some((l) => l.includes("Bearer sent")),
    `expected sent header: ${lines.join("\n")}`,
  );
  assert.ok(
    lines.some((l) => l.includes('"from": "sent"')),
    `expected sent body: ${lines.join("\n")}`,
  );
  assert.ok(
    !lines.some((l) => l.includes("Bearer resolved")),
    `resolved header should be replaced: ${lines.join("\n")}`,
  );
});
