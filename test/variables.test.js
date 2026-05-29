/**
 * Variable detection & merge tests — imports from compiled dist/.
 * Run via:  npm test  (which calls tsc first)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  detectVariables,
  mergeVariables,
  resolveVariables,
} from "../dist/variables/index.js";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeFlow(overrides = {}) {
  return {
    kind: "flow",
    folderPath: "/fake",
    name: "test flow",
    group: null,
    order: 0,
    environments: [],
    continueOnError: false,
    variables: {},
    requires: [],
    enums: {},
    requests: [],
    ...overrides,
  };
}

function makeRequest(overrides = {}) {
  return {
    name: "req",
    url: "",
    method: "GET",
    headers: {},
    scripts: [],
    order: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// detectVariables — token scanning
// ---------------------------------------------------------------------------

test("detectVariables: scans {{name}} tokens from request URL", () => {
  const flow = makeFlow({
    requests: [makeRequest({ url: "https://{{base}}/users/{{user-id}}" })],
  });
  const meta = detectVariables(flow);
  assert.deepEqual(
    meta.map((m) => m.name),
    ["base", "user-id"],
  );
});

test("detectVariables: scans tokens from request header values", () => {
  const flow = makeFlow({
    requests: [
      makeRequest({
        url: "https://example.com",
        headers: {
          Authorization: "Bearer {{token}}",
          Accept: "application/json",
        },
      }),
    ],
  });
  const meta = detectVariables(flow);
  assert.deepEqual(
    meta.map((m) => m.name),
    ["token"],
  );
});

test("detectVariables: scans tokens from request body content", () => {
  const flow = makeFlow({
    requests: [
      makeRequest({
        url: "https://example.com",
        body: {
          type: "json",
          content: '{"email":"{{email}}","firstName":"{{first-name}}"}',
        },
      }),
    ],
  });
  const meta = detectVariables(flow);
  assert.deepEqual(
    meta.map((m) => m.name),
    ["email", "first-name"],
  );
});

test("detectVariables: excludes postman dynamic variables", () => {
  const flow = makeFlow({
    requests: [
      makeRequest({
        url: "https://example.com/{{userId}}",
        body: {
          type: "json",
          content: '{"requestId":"{{$randomUUID}}","userId":"{{userId}}"}',
        },
      }),
    ],
  });
  const meta = detectVariables(flow);
  assert.deepEqual(
    meta.map((m) => m.name),
    ["userId"],
  );
});

test("detectVariables: scans tokens across url, headers, and body", () => {
  const flow = makeFlow({
    requests: [
      makeRequest({
        url: "https://{{base}}/endpoint",
        headers: { Authorization: "Bearer {{token}}" },
        body: { type: "text", content: "hello {{name}}" },
      }),
    ],
  });
  const meta = detectVariables(flow);
  assert.deepEqual(
    meta.map((m) => m.name),
    ["base", "token", "name"],
  );
});

test("detectVariables: deduplicates tokens across multiple requests", () => {
  const flow = makeFlow({
    requests: [
      makeRequest({ url: "https://{{base}}/a" }),
      makeRequest({ url: "https://{{base}}/b", headers: { X: "{{token}}" } }),
      makeRequest({
        url: "https://{{base}}/c",
        body: { type: "text", content: "{{token}} {{new}}" },
      }),
    ],
  });
  const meta = detectVariables(flow);
  assert.deepEqual(
    meta.map((m) => m.name),
    ["base", "token", "new"],
  );
});

test("detectVariables: returns empty array for flow with no tokens", () => {
  const flow = makeFlow({
    requests: [makeRequest({ url: "https://example.com/users" })],
  });
  assert.deepEqual(detectVariables(flow), []);
});

// ---------------------------------------------------------------------------
// detectVariables — metadata annotation
// ---------------------------------------------------------------------------

test("detectVariables: required flag set from flow.requires", () => {
  const flow = makeFlow({
    requires: ["email"],
    requests: [
      makeRequest({
        body: {
          type: "json",
          content: '{"email":"{{email}}","name":"{{name}}"}',
        },
      }),
    ],
  });
  const meta = detectVariables(flow);
  const emailMeta = meta.find((m) => m.name === "email");
  const nameMeta = meta.find((m) => m.name === "name");
  assert.ok(emailMeta);
  assert.equal(emailMeta.required, true);
  assert.ok(nameMeta);
  assert.equal(nameMeta.required, false);
});

test("detectVariables: enums populated from flow.enums", () => {
  const flow = makeFlow({
    enums: { product: ["zip-pay", "zip-money"] },
    requests: [
      makeRequest({
        body: { type: "json", content: '{"product":"{{product}}"}' },
      }),
    ],
  });
  const meta = detectVariables(flow);
  const productMeta = meta.find((m) => m.name === "product");
  assert.ok(productMeta);
  assert.deepEqual(productMeta.enums, ["zip-pay", "zip-money"]);
});

test("detectVariables: enums is empty array for vars not in flow.enums", () => {
  const flow = makeFlow({
    requests: [makeRequest({ url: "https://{{base}}" })],
  });
  const meta = detectVariables(flow);
  assert.deepEqual(meta[0].enums, []);
});

test("detectVariables: defaultValue populated from flow.variables", () => {
  const flow = makeFlow({
    variables: { base: "api.example.com" },
    requests: [makeRequest({ url: "https://{{base}}" })],
  });
  const meta = detectVariables(flow);
  assert.equal(meta[0].defaultValue, "api.example.com");
});

test("detectVariables: defaultValue is undefined when not in flow.variables", () => {
  const flow = makeFlow({
    requests: [makeRequest({ url: "https://{{base}}" })],
  });
  const meta = detectVariables(flow);
  assert.equal(meta[0].defaultValue, undefined);
});

// ---------------------------------------------------------------------------
// detectVariables — tilde and dollar characters don't confuse the scanner
// ---------------------------------------------------------------------------

test("detectVariables: ~ and $ in body content do not produce spurious tokens", () => {
  const flow = makeFlow({
    requests: [
      makeRequest({
        url: "https://example.com",
        body: { type: "text", content: "path=~/home/$USER value=${VAR}" },
      }),
    ],
  });
  const meta = detectVariables(flow);
  assert.deepEqual(meta, [], "no {{...}} tokens — ~ and $ should not match");
});

test("detectVariables: ~ and $ mixed with real tokens are extracted cleanly", () => {
  const flow = makeFlow({
    requests: [
      makeRequest({
        url: "https://{{base}}/path",
        body: {
          type: "text",
          content: "home=~/data amount=$100 user={{user-id}}",
        },
      }),
    ],
  });
  const meta = detectVariables(flow);
  assert.deepEqual(
    meta.map((m) => m.name),
    ["base", "user-id"],
  );
});

// ---------------------------------------------------------------------------
// mergeVariables — precedence
// ---------------------------------------------------------------------------

test("mergeVariables: later layer wins on collision", () => {
  const result = mergeVariables([{ a: "low" }, { a: "high" }]);
  assert.equal(result.a, "high");
});

test("mergeVariables: all layers contribute distinct keys", () => {
  const result = mergeVariables([{ a: "1" }, { b: "2" }, { c: "3" }]);
  assert.deepEqual(result, { a: "1", b: "2", c: "3" });
});

test("mergeVariables: empty layers returns empty object", () => {
  assert.deepEqual(mergeVariables([]), {});
});

test("mergeVariables: single layer is returned as-is", () => {
  const result = mergeVariables([{ x: "hello", y: "world" }]);
  assert.deepEqual(result, { x: "hello", y: "world" });
});

test("mergeVariables: four-layer precedence (flow < globals < env < form)", () => {
  const flowDefaults = { a: "flow", b: "flow", c: "flow", d: "flow" };
  const globals = { b: "globals", c: "globals", d: "globals" };
  const env = { c: "env", d: "env" };
  const formInput = { d: "form" };
  const result = mergeVariables([flowDefaults, globals, env, formInput]);
  assert.equal(result.a, "flow");
  assert.equal(result.b, "globals");
  assert.equal(result.c, "env");
  assert.equal(result.d, "form");
});

// ---------------------------------------------------------------------------
// resolveVariables
// ---------------------------------------------------------------------------

test("resolveVariables: full four-layer precedence ordering", () => {
  const flow = makeFlow({
    variables: { a: "flow", b: "flow", c: "flow", d: "flow" },
  });
  const globals = {
    values: [
      { key: "b", value: "globals", enabled: true },
      { key: "c", value: "globals", enabled: true },
      { key: "d", value: "globals", enabled: true },
    ],
    filePath: "/fake/globals",
  };
  const env = {
    id: "dev",
    name: "dev",
    filePath: "/fake/env",
    values: [
      { key: "c", value: "env", enabled: true },
      { key: "d", value: "env", enabled: true },
    ],
  };
  const formInput = { d: "form" };
  const result = resolveVariables(flow, env, globals, formInput);
  assert.equal(result.a, "flow");
  assert.equal(result.b, "globals");
  assert.equal(result.c, "env");
  assert.equal(result.d, "form");
});

test("resolveVariables: required var absent from all layers gets value ''", () => {
  const flow = makeFlow({ requires: ["first-name", "email"] });
  const result = resolveVariables(flow, null, null, {});
  assert.equal(result["first-name"], "");
  assert.equal(result["email"], "");
});

test("resolveVariables: required var present in env is NOT overwritten with ''", () => {
  const flow = makeFlow({ requires: ["token"] });
  const env = {
    id: "dev",
    name: "dev",
    filePath: "/fake/env",
    values: [{ key: "token", value: "abc123", enabled: true }],
  };
  const result = resolveVariables(flow, env, null, {});
  assert.equal(result.token, "abc123");
});

test("resolveVariables: disabled env values are excluded", () => {
  const flow = makeFlow();
  const env = {
    id: "dev",
    name: "dev",
    filePath: "/fake/env",
    values: [
      { key: "active", value: "yes", enabled: true },
      { key: "inactive", value: "no", enabled: false },
    ],
  };
  const result = resolveVariables(flow, env, null, {});
  assert.equal(result.active, "yes");
  assert.ok(!("inactive" in result));
});

test("resolveVariables: disabled globals values are excluded", () => {
  const flow = makeFlow();
  const globals = {
    values: [
      { key: "g-active", value: "yes", enabled: true },
      { key: "g-off", value: "no", enabled: false },
    ],
    filePath: "/fake/globals",
  };
  const result = resolveVariables(flow, null, globals, {});
  assert.equal(result["g-active"], "yes");
  assert.ok(!("g-off" in result));
});

test("resolveVariables: null env and null globals are handled", () => {
  const flow = makeFlow({ variables: { base: "api.example.com" } });
  const result = resolveVariables(flow, null, null, {});
  assert.equal(result.base, "api.example.com");
});

test("resolveVariables: form input wins over environment", () => {
  const flow = makeFlow();
  const env = {
    id: "dev",
    name: "dev",
    filePath: "/fake/env",
    values: [{ key: "base", value: "dev-api.example.com", enabled: true }],
  };
  const result = resolveVariables(flow, env, null, {
    base: "override.example.com",
  });
  assert.equal(result.base, "override.example.com");
});
