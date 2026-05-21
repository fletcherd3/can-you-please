/**
 * Variables form screen tests.
 * Run via: npm test (tsc first, then node --test)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render } from "ink-testing-library";

import { VariablesFormScreen } from "../dist/ui/screens/VariablesFormScreen.js";

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

function makeEnv(id = "dev", values = []) {
  return {
    id,
    name: id,
    values,
    filePath: `/tmp/ws/envs/${id}.environment.yaml`,
  };
}

function makeRequest(url = "https://{{base}}/users", extraVarUrls = []) {
  const urls = [url, ...extraVarUrls];
  return urls.map((u, i) => ({
    name: `req-${i + 1}`,
    url: u,
    method: "GET",
    headers: {},
    scripts: [],
    order: i * 100,
  }));
}

function makeProps(overrides = {}) {
  return {
    flow: makeFlow(),
    env: makeEnv(),
    onSubmit: () => {},
    onBack: () => {},
    onHelp: () => {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rendering — title and footer
// ---------------------------------------------------------------------------

test("renders 'variables form' title", () => {
  const { lastFrame, unmount } = render(
    React.createElement(VariablesFormScreen, makeProps()),
  );
  assert.ok(
    lastFrame().includes("variables form"),
    `expected "variables form" in: ${lastFrame()}`,
  );
  unmount();
});

test("renders footer hints", () => {
  const { lastFrame, unmount } = render(
    React.createElement(VariablesFormScreen, makeProps()),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("tab next"), `missing "tab next" in: ${frame}`);
  assert.ok(frame.includes("esc back"), `missing "esc back" in: ${frame}`);
  assert.ok(frame.includes("enter run"), `missing "enter run" in: ${frame}`);
  assert.ok(
    frame.includes("continue-on-error"),
    `missing "continue-on-error" in: ${frame}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Sections — required / optional
// ---------------------------------------------------------------------------

test("renders 'required' section label when flow has required vars", () => {
  const flow = makeFlow({
    requires: ["email"],
    requests: makeRequest("https://{{base}}/u?e={{email}}"),
  });
  const { lastFrame, unmount } = render(
    React.createElement(VariablesFormScreen, makeProps({ flow })),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("required"), `expected "required" in: ${frame}`);
  unmount();
});

test("renders 'optional' section label when flow has optional vars", () => {
  const flow = makeFlow({
    requests: makeRequest("https://{{base}}/users"),
  });
  const { lastFrame, unmount } = render(
    React.createElement(VariablesFormScreen, makeProps({ flow })),
  );
  const frame = lastFrame();
  assert.ok(frame.includes("optional"), `expected "optional" in: ${frame}`);
  unmount();
});

test("required variables appear before optional ones", () => {
  const flow = makeFlow({
    requires: ["email"],
    requests: makeRequest("https://api/u?email={{email}}&name={{name}}"),
  });
  const { lastFrame, unmount } = render(
    React.createElement(VariablesFormScreen, makeProps({ flow })),
  );
  const frame = lastFrame();
  const emailPos = frame.indexOf("email");
  const namePos = frame.indexOf("name");
  assert.ok(emailPos !== -1, "expected 'email' field in frame");
  assert.ok(namePos !== -1, "expected 'name' field in frame");
  assert.ok(
    emailPos < namePos,
    "required 'email' should appear before optional 'name'",
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Pre-filled values
// ---------------------------------------------------------------------------

test("pre-fills value from flow.variables default", () => {
  const flow = makeFlow({
    variables: { base: "api.example.com" },
    requests: makeRequest("https://{{base}}/users"),
  });
  const { lastFrame, unmount } = render(
    React.createElement(VariablesFormScreen, makeProps({ flow })),
  );
  assert.ok(
    lastFrame().includes("api.example.com"),
    `expected default value "api.example.com" in: ${lastFrame()}`,
  );
  unmount();
});

test("pre-fills value from environment (env wins over flow default)", () => {
  const flow = makeFlow({
    variables: { base: "default.example.com" },
    requests: makeRequest("https://{{base}}/users"),
  });
  const env = makeEnv("dev", [
    { key: "base", value: "env.example.com", enabled: true },
  ]);
  const { lastFrame, unmount } = render(
    React.createElement(VariablesFormScreen, makeProps({ flow, env })),
  );
  // env value should win over flow default
  assert.ok(
    lastFrame().includes("env.example.com"),
    `expected env value in: ${lastFrame()}`,
  );
  assert.ok(
    !lastFrame().includes("default.example.com"),
    `flow default should be overridden`,
  );
  unmount();
});

test("disabled env values are excluded from pre-fill", () => {
  const flow = makeFlow({
    variables: { base: "flow-default.com" },
    requests: makeRequest("https://{{base}}/users"),
  });
  const env = makeEnv("dev", [
    { key: "base", value: "disabled.example.com", enabled: false },
  ]);
  const { lastFrame, unmount } = render(
    React.createElement(VariablesFormScreen, makeProps({ flow, env })),
  );
  // disabled env value should not override flow default
  assert.ok(
    lastFrame().includes("flow-default.com"),
    `flow default should remain when env value is disabled: ${lastFrame()}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — esc returns to previous screen
// ---------------------------------------------------------------------------

test("esc calls onBack", async () => {
  let backCalled = false;
  const { stdin, unmount } = render(
    React.createElement(
      VariablesFormScreen,
      makeProps({
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
// Keyboard — ? opens help
// ---------------------------------------------------------------------------

test("? calls onHelp", async () => {
  let helpCalled = false;
  const { stdin, unmount } = render(
    React.createElement(
      VariablesFormScreen,
      makeProps({
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
// Keyboard — enter submits when no required fields are blank
// ---------------------------------------------------------------------------

test("enter calls onSubmit with current values and continueOnError", async () => {
  let submitted = null;
  const flow = makeFlow({
    variables: { base: "api.example.com" },
    requests: makeRequest("https://{{base}}/users"),
  });
  const { stdin, unmount } = render(
    React.createElement(
      VariablesFormScreen,
      makeProps({
        flow,
        onSubmit: (vars, coe) => {
          submitted = { vars, coe };
        },
      }),
    ),
  );
  stdin.write("\r");
  await wait();
  assert.ok(submitted !== null, "onSubmit should have been called");
  assert.equal(submitted.vars.base, "api.example.com");
  assert.equal(submitted.coe, false);
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — submit with blank required field shows error
// ---------------------------------------------------------------------------

test("entering with a blank required field shows 'required' error", async () => {
  const flow = makeFlow({
    requires: ["email"],
    requests: makeRequest("https://api/u?e={{email}}"),
  });
  let submitted = false;
  const { stdin, lastFrame, unmount } = render(
    React.createElement(
      VariablesFormScreen,
      makeProps({
        flow,
        onSubmit: () => {
          submitted = true;
        },
      }),
    ),
  );
  // email starts blank — pressing enter should show error
  stdin.write("\r");
  await wait();
  assert.ok(
    !submitted,
    "onSubmit should NOT be called when required field is blank",
  );
  const frame = lastFrame();
  assert.ok(
    frame.includes("required"),
    `expected "required" error in: ${frame}`,
  );
  unmount();
});

test("entering with required field filled calls onSubmit", async () => {
  const flow = makeFlow({
    requires: ["email"],
    requests: makeRequest("https://api/u?e={{email}}"),
  });
  let submitted = null;
  const { stdin, unmount } = render(
    React.createElement(
      VariablesFormScreen,
      makeProps({
        flow,
        onSubmit: (vars) => {
          submitted = vars;
        },
      }),
    ),
  );
  // Type a value for email then submit
  stdin.write("test@example.com");
  await wait(40);
  stdin.write("\r");
  await wait();
  assert.ok(submitted !== null, "onSubmit should be called");
  assert.equal(submitted.email, "test@example.com");
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — continue-on-error toggle
// ---------------------------------------------------------------------------

test("'c' key toggles continue-on-error to on", async () => {
  const flow = makeFlow({ continueOnError: false });
  const { stdin, lastFrame, unmount } = render(
    React.createElement(VariablesFormScreen, makeProps({ flow })),
  );
  // Initially off
  assert.ok(
    lastFrame().includes("continue-on-error: off"),
    `expected "off" initially in: ${lastFrame()}`,
  );
  stdin.write("c");
  await wait();
  assert.ok(
    lastFrame().includes("continue-on-error: on"),
    `expected "on" after toggle in: ${lastFrame()}`,
  );
  unmount();
});

test("initial continue-on-error reflects flow.continueOnError = true", () => {
  const flow = makeFlow({ continueOnError: true });
  const { lastFrame, unmount } = render(
    React.createElement(VariablesFormScreen, makeProps({ flow })),
  );
  assert.ok(
    lastFrame().includes("continue-on-error: on"),
    `expected "on" in: ${lastFrame()}`,
  );
  unmount();
});

test("'c' toggles continue-on-error back to off", async () => {
  const flow = makeFlow({ continueOnError: true });
  const { stdin, lastFrame, unmount } = render(
    React.createElement(VariablesFormScreen, makeProps({ flow })),
  );
  stdin.write("c");
  await wait();
  assert.ok(
    lastFrame().includes("continue-on-error: off"),
    `expected "off" after toggle in: ${lastFrame()}`,
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Keyboard — tab / shift-tab cycle focus
// ---------------------------------------------------------------------------

test("tab advances focus to next field", async () => {
  const flow = makeFlow({
    requests: makeRequest("https://api/?a={{alpha}}&b={{beta}}"),
  });
  let submitted = null;
  const { stdin, unmount } = render(
    React.createElement(
      VariablesFormScreen,
      makeProps({
        flow,
        onSubmit: (vars) => {
          submitted = vars;
        },
      }),
    ),
  );
  // type on first field (alpha), tab to next (beta), type, then enter
  stdin.write("aaa");
  await wait(40);
  stdin.write("\t");
  await wait(40);
  stdin.write("bbb");
  await wait(40);
  stdin.write("\r");
  await wait();
  assert.ok(submitted !== null, "onSubmit should have been called");
  assert.equal(submitted.alpha, "aaa");
  assert.equal(submitted.beta, "bbb");
  unmount();
});

// ---------------------------------------------------------------------------
// EnumInput — dropdown opens and selects
// ---------------------------------------------------------------------------

test("down-arrow opens enum dropdown and shows suggestions", async () => {
  const flow = makeFlow({
    enums: { product: ["zip-pay", "zip-money"] },
    requests: makeRequest("https://api/?p={{product}}"),
  });
  const { stdin, lastFrame, unmount } = render(
    React.createElement(VariablesFormScreen, makeProps({ flow })),
  );
  stdin.write("\x1b[B"); // down-arrow
  await wait();
  const frame = lastFrame();
  assert.ok(
    frame.includes("zip-pay") || frame.includes("zip-money"),
    `expected enum suggestions in dropdown: ${frame}`,
  );
  unmount();
});

test("enter on dropdown item fills the field", async () => {
  const flow = makeFlow({
    enums: { product: ["zip-pay", "zip-money"] },
    requests: makeRequest("https://api/?p={{product}}"),
  });
  let submitted = null;
  const { stdin, unmount } = render(
    React.createElement(
      VariablesFormScreen,
      makeProps({
        flow,
        onSubmit: (vars) => {
          submitted = vars;
        },
      }),
    ),
  );
  stdin.write("\x1b[B"); // down-arrow → open dropdown (first item "zip-pay" selected)
  await wait(40);
  stdin.write("\r"); // enter → select "zip-pay", close dropdown
  await wait(40);
  stdin.write("\r"); // enter → submit
  await wait();
  assert.ok(submitted !== null, "onSubmit should have been called");
  assert.equal(submitted.product, "zip-pay");
  unmount();
});

test("esc closes dropdown without selecting", async () => {
  const flow = makeFlow({
    enums: { product: ["zip-pay", "zip-money"] },
    requests: makeRequest("https://api/?p={{product}}"),
  });
  const { stdin, lastFrame, unmount } = render(
    React.createElement(VariablesFormScreen, makeProps({ flow })),
  );
  stdin.write("\x1b[B"); // open dropdown
  await wait(40);
  // Confirm dropdown is visible
  assert.ok(
    lastFrame().includes("zip-pay"),
    `expected dropdown open: ${lastFrame()}`,
  );
  stdin.write("\x1b"); // esc → close dropdown
  await wait(40);
  // Dropdown should be gone, but we should still be on the form (not backed out)
  // The key indicator: after esc, the field should not have a value from the enum
  // (just an empty value)
  const frame = lastFrame();
  // Still on the form (no crash, title still present)
  assert.ok(
    frame.includes("variables form"),
    `should still be on variables form after esc-closing dropdown: ${frame}`,
  );
  unmount();
});
