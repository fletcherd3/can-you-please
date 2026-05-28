/**
 * Run-logger tests — imports from compiled dist/.
 * Run via:  npm test  (which calls tsc first)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildLogFilename,
  formatFileTimestamp,
  truncateBody,
  createRunLogger,
} from "../dist/logger/index.js";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeFlow(overrides = {}) {
  return {
    kind: "flow",
    folderPath: "/fake",
    name: "my-flow",
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
    name: "req-1",
    url: "https://example.com",
    method: "GET",
    headers: {},
    scripts: [],
    order: 0,
    ...overrides,
  };
}

function makeStarted(overrides = {}) {
  return {
    type: "RequestStarted",
    name: "req-1",
    method: "GET",
    url: "https://example.com",
    resolvedRequest: {
      method: "GET",
      url: "https://example.com",
      headers: {},
    },
    ...overrides,
  };
}

function makeCompleted(overrides = {}) {
  return {
    type: "RequestCompleted",
    name: "req-1",
    method: "GET",
    url: "https://example.com",
    status: 200,
    statusText: "OK",
    responseTimeMs: 42,
    headers: {},
    body: "ok",
    resolvedRequest: {
      method: "GET",
      url: "https://example.com",
      headers: {},
    },
    failed: false,
    consoleOutput: [],
    variablesSet: {},
    ...overrides,
  };
}

function makeFinished(overrides = {}) {
  return {
    type: "RunFinished",
    totalRequests: 1,
    failedRequests: 0,
    durationMs: 100,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildLogFilename — filename generation
// ---------------------------------------------------------------------------

test("buildLogFilename: ungrouped flow, pass", () => {
  const flow = makeFlow({ name: "create-user", group: null });
  const name = buildLogFilename(flow, "2026-05-21_10-30-00", "pass");
  assert.equal(name, "2026-05-21_10-30-00_create-user_pass.log");
});

test("buildLogFilename: ungrouped flow, fail", () => {
  const flow = makeFlow({ name: "create-user", group: null });
  const name = buildLogFilename(flow, "2026-05-21_10-30-00", "fail");
  assert.equal(name, "2026-05-21_10-30-00_create-user_fail.log");
});

test("buildLogFilename: grouped flow — group and flow joined with __", () => {
  const flow = makeFlow({ name: "create-user", group: "onboarding" });
  const name = buildLogFilename(flow, "2026-05-21_10-30-00", "pass");
  assert.equal(name, "2026-05-21_10-30-00_onboarding__create-user_pass.log");
});

test("buildLogFilename: grouped flow, fail", () => {
  const flow = makeFlow({ name: "kyc-check", group: "compliance" });
  const name = buildLogFilename(flow, "2026-01-15_08-05-03", "fail");
  assert.equal(name, "2026-01-15_08-05-03_compliance__kyc-check_fail.log");
});

test("formatFileTimestamp: pads single-digit values", () => {
  const d = new Date(2026, 0, 5, 8, 3, 7); // Jan 5 08:03:07 local
  assert.equal(formatFileTimestamp(d), "2026-01-05_08-03-07");
});

test("formatFileTimestamp: handles double-digit values", () => {
  const d = new Date(2026, 11, 31, 23, 59, 59); // Dec 31 23:59:59 local
  assert.equal(formatFileTimestamp(d), "2026-12-31_23-59-59");
});

// ---------------------------------------------------------------------------
// truncateBody — 1 MB boundary
// ---------------------------------------------------------------------------

test("truncateBody: body under 1 MB is returned unchanged", () => {
  const body = "x".repeat(500_000);
  assert.equal(truncateBody(body), body);
});

test("truncateBody: body exactly at 1 MB is returned unchanged", () => {
  // 1 048 576 ASCII chars = exactly 1 MB
  const body = "a".repeat(1_048_576);
  assert.equal(truncateBody(body), body);
});

test("truncateBody: body over 1 MB is truncated with marker", () => {
  const overLimit = "b".repeat(1_048_577); // 1 MB + 1 byte
  const result = truncateBody(overLimit);
  assert.ok(
    result.endsWith(`\n[truncated, original size: 1048577 bytes]`),
    `expected truncation marker, got: ${result.slice(-60)}`,
  );
  // The text before the marker should be exactly 1 MB of 'b'
  const textPart = result.split("\n[truncated")[0];
  assert.equal(Buffer.byteLength(textPart, "utf8"), 1_048_576);
});

test("truncateBody: reports correct byte count for multi-byte chars", () => {
  // Each '€' is 3 bytes in UTF-8. 349526 × 3 = 1 048 578 bytes > 1 MB.
  const body = "€".repeat(349_526);
  const totalBytes = Buffer.byteLength(body, "utf8"); // 1 048 578
  const result = truncateBody(body);
  assert.ok(result.includes(`[truncated, original size: ${totalBytes} bytes]`));
});

// ---------------------------------------------------------------------------
// createRunLogger — integration (writes to a real temp dir)
// ---------------------------------------------------------------------------

test("createRunLogger: creates log file in the given directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cyp-logger-test-"));
  const flow = makeFlow({ requests: [makeRequest()] });
  const logger = createRunLogger(flow, dir);

  logger.write(makeStarted());
  logger.write(makeCompleted());
  logger.write(makeFinished());
  await logger.close("pass");

  const files = await readdir(dir);
  assert.equal(files.length, 1);
  assert.ok(files[0].endsWith("_pass.log"), `unexpected filename: ${files[0]}`);
});

test("createRunLogger: creates logDir if it does not exist", async () => {
  const base = await mkdtemp(join(tmpdir(), "cyp-logger-test-"));
  const dir = join(base, "nested", "logs");

  const flow = makeFlow({ requests: [makeRequest()] });
  const logger = createRunLogger(flow, dir);
  logger.write(makeStarted());
  logger.write(makeCompleted());
  await logger.close("pass");

  const files = await readdir(dir);
  assert.equal(files.length, 1);
});

test("createRunLogger: fail outcome suffix in filename", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cyp-logger-test-"));
  const flow = makeFlow({ requests: [makeRequest()] });
  const logger = createRunLogger(flow, dir);

  logger.write(makeStarted());
  logger.write(makeCompleted({ failed: true, status: 500 }));
  await logger.close("fail");

  const [filename] = await readdir(dir);
  assert.ok(filename.endsWith("_fail.log"), `unexpected filename: ${filename}`);
});

// ---------------------------------------------------------------------------
// createRunLogger — multi-request ordering
// ---------------------------------------------------------------------------

test("createRunLogger: multi-request sections numbered N/M in order", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cyp-logger-test-"));
  const requests = [
    makeRequest({ name: "step-1", order: 0 }),
    makeRequest({ name: "step-2", order: 1 }),
    makeRequest({ name: "step-3", order: 2 }),
  ];
  const flow = makeFlow({ requests });
  const logger = createRunLogger(flow, dir);

  for (const req of ["step-1", "step-2", "step-3"]) {
    logger.write(makeStarted({ name: req }));
    logger.write(makeCompleted({ name: req }));
  }
  logger.write(makeFinished({ totalRequests: 3 }));
  await logger.close("pass");

  const [filename] = await readdir(dir);
  const content = await readFile(join(dir, filename), "utf8");

  assert.ok(content.includes("=== request 1/3: step-1"), "missing section 1/3");
  assert.ok(content.includes("=== request 2/3: step-2"), "missing section 2/3");
  assert.ok(content.includes("=== request 3/3: step-3"), "missing section 3/3");

  // Verify ordering: section 1 appears before section 2, section 2 before 3
  const idx1 = content.indexOf("=== request 1/3");
  const idx2 = content.indexOf("=== request 2/3");
  const idx3 = content.indexOf("=== request 3/3");
  assert.ok(idx1 < idx2, "section 1 should appear before section 2");
  assert.ok(idx2 < idx3, "section 2 should appear before section 3");
});

test("createRunLogger: section includes method, status and timing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cyp-logger-test-"));
  const flow = makeFlow({ requests: [makeRequest({ method: "POST" })] });
  const logger = createRunLogger(flow, dir);

  logger.write(
    makeStarted({
      method: "POST",
      resolvedRequest: {
        method: "POST",
        url: "https://example.com",
        headers: {},
      },
    }),
  );
  logger.write(
    makeCompleted({
      method: "POST",
      status: 201,
      responseTimeMs: 88,
      resolvedRequest: {
        method: "POST",
        url: "https://example.com",
        headers: {},
      },
    }),
  );
  await logger.close("pass");

  const [filename] = await readdir(dir);
  const content = await readFile(join(dir, filename), "utf8");

  assert.ok(
    content.includes("(POST 201, 88ms)"),
    `expected timing in header, got: ${content.slice(0, 200)}`,
  );
});

test("createRunLogger: response body appears in section", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cyp-logger-test-"));
  const flow = makeFlow({ requests: [makeRequest()] });
  const logger = createRunLogger(flow, dir);

  logger.write(makeStarted());
  logger.write(makeCompleted({ body: '{"id":"abc"}' }));
  await logger.close("pass");

  const [filename] = await readdir(dir);
  const content = await readFile(join(dir, filename), "utf8");
  assert.ok(content.includes('{"id":"abc"}'));
});

test("createRunLogger: includes request source and definition snapshot fallback", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cyp-logger-test-"));
  const flow = makeFlow({
    requests: [
      makeRequest({
        method: "POST",
        url: "https://api.dev/{{env}}/users",
        headers: { Authorization: "Bearer {{tok}}" },
        body: { type: "json", content: '{"from":"definition"}' },
      }),
    ],
  });
  const logger = createRunLogger(flow, dir);

  logger.write(
    makeStarted({
      method: "POST",
      url: "https://api.dev/sand/users",
      resolvedRequest: undefined,
    }),
  );
  logger.write(
    makeCompleted({
      method: "POST",
      url: "https://api.dev/sand/users",
      resolvedRequest: undefined,
      sentRequest: undefined,
    }),
  );
  await logger.close("pass");

  const [filename] = await readdir(dir);
  const content = await readFile(join(dir, filename), "utf8");
  assert.ok(content.includes("request source: definition"));
  assert.ok(content.includes("url: https://api.dev/{{env}}/users"));
  assert.ok(content.includes("Authorization: Bearer {{tok}}"));
  assert.ok(content.includes('{"from":"definition"}'));
});

test("createRunLogger: uses resolved snapshot when sent snapshot is unavailable", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cyp-logger-test-"));
  const flow = makeFlow({
    requests: [
      makeRequest({
        method: "POST",
        url: "https://api.dev/{{env}}/users",
        headers: { Authorization: "Bearer {{tok}}" },
        body: { type: "json", content: '{"from":"definition"}' },
      }),
    ],
  });
  const logger = createRunLogger(flow, dir);

  logger.write(
    makeStarted({
      method: "POST",
      url: "https://api.dev/sand/users",
      resolvedRequest: {
        method: "POST",
        url: "https://api.dev/sand/users",
        headers: { Authorization: "Bearer resolved" },
        body: { mode: "raw", content: '{"from":"resolved"}' },
      },
    }),
  );
  logger.write(
    makeCompleted({
      method: "POST",
      url: "https://api.dev/sand/users",
      resolvedRequest: {
        method: "POST",
        url: "https://api.dev/sand/users",
        headers: { Authorization: "Bearer resolved" },
        body: { mode: "raw", content: '{"from":"resolved"}' },
      },
      sentRequest: undefined,
    }),
  );
  await logger.close("pass");

  const [filename] = await readdir(dir);
  const content = await readFile(join(dir, filename), "utf8");
  assert.ok(content.includes("request source: resolved"));
  assert.ok(content.includes("url: https://api.dev/sand/users"));
  assert.ok(content.includes("Authorization: Bearer resolved"));
  assert.ok(content.includes('{"from":"resolved"}'));
  assert.ok(!content.includes("{{tok}}"));
  assert.ok(!content.includes('{"from":"definition"}'));
});

test("createRunLogger: sent snapshot retrospectively replaces resolved request detail", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cyp-logger-test-"));
  const flow = makeFlow({
    requests: [
      makeRequest({
        method: "POST",
        url: "https://api.dev/{{env}}/users",
        headers: { Authorization: "Bearer {{tok}}" },
        body: { type: "json", content: '{"from":"definition"}' },
      }),
    ],
  });
  const logger = createRunLogger(flow, dir);

  logger.write(
    makeStarted({
      method: "POST",
      url: "https://api.dev/sand/users",
      resolvedRequest: {
        method: "POST",
        url: "https://api.dev/sand/users",
        headers: { Authorization: "Bearer resolved" },
        body: { mode: "raw", content: '{"from":"resolved"}' },
      },
    }),
  );
  logger.write(
    makeCompleted({
      method: "POST",
      url: "https://api.dev/sand/users",
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
    }),
  );
  await logger.close("pass");

  const [filename] = await readdir(dir);
  const content = await readFile(join(dir, filename), "utf8");
  assert.ok(content.includes("request source: sent"));
  assert.ok(content.includes("url: https://api.dev/sent/users"));
  assert.ok(content.includes("Authorization: Bearer sent"));
  assert.ok(content.includes('{"from":"sent"}'));
  assert.ok(!content.includes("Bearer resolved"));
  assert.ok(!content.includes('{"from":"resolved"}'));
});

test("createRunLogger: error detail section on failure", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cyp-logger-test-"));
  const flow = makeFlow({ requests: [makeRequest()] });
  const logger = createRunLogger(flow, dir);

  logger.write(makeStarted());
  logger.write(
    makeCompleted({
      failed: true,
      status: 422,
      body: '{"error":"INVALID","message":"bad input","details":{"field":"email"}}',
      parsedResponseError: {
        error: "INVALID",
        message: "bad input",
        details: { field: "email" },
      },
    }),
  );
  await logger.close("fail");

  const [filename] = await readdir(dir);
  const content = await readFile(join(dir, filename), "utf8");
  assert.ok(content.includes("error detail:"), "missing error detail section");
  assert.ok(content.includes("error: INVALID"));
  assert.ok(content.includes("message: bad input"));
});

test("createRunLogger: console output section included", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cyp-logger-test-"));
  const flow = makeFlow({ requests: [makeRequest()] });
  const logger = createRunLogger(flow, dir);

  logger.write(makeStarted());
  logger.write(
    makeCompleted({ consoleOutput: ["[log] hello", "[log] world"] }),
  );
  await logger.close("pass");

  const [filename] = await readdir(dir);
  const content = await readFile(join(dir, filename), "utf8");
  assert.ok(content.includes("console output:"));
  assert.ok(content.includes("[log] hello"));
  assert.ok(content.includes("[log] world"));
});

test("createRunLogger: variables set section included", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cyp-logger-test-"));
  const flow = makeFlow({ requests: [makeRequest()] });
  const logger = createRunLogger(flow, dir);

  logger.write(makeStarted());
  logger.write(makeCompleted({ variablesSet: { userId: "u-123" } }));
  await logger.close("pass");

  const [filename] = await readdir(dir);
  const content = await readFile(join(dir, filename), "utf8");
  assert.ok(content.includes("variables set:"));
  assert.ok(content.includes("userId = u-123"));
});
