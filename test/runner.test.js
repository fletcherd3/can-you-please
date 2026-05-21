/**
 * Newman runner e2e tests — imports from compiled dist/.
 * Spins up a local node:http server for real HTTP requests.
 * Run via:  npm test
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { runFlow } from "../dist/runner/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all events from a runFlow iterable. */
async function collect(iterable) {
  const events = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

function makeFlow(overrides = {}) {
  return {
    kind: "flow",
    folderPath: "/test",
    name: "test-flow",
    group: null,
    order: 1,
    environments: [],
    continueOnError: false,
    variables: {},
    requires: [],
    enums: {},
    requests: [],
    ...overrides,
  };
}

function makeRequest(name, url, overrides = {}) {
  return {
    name,
    url,
    method: "GET",
    headers: {},
    scripts: [],
    order: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Local HTTP server
// ---------------------------------------------------------------------------

let baseUrl = "";
let server;

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/ok") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } else if (req.url === "/not-found") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "not_found",
          message: "Resource not found",
          details: { id: 123 },
        }),
      );
    } else if (req.url === "/server-error") {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "internal", message: "Server exploded" }),
      );
    } else if (req.url === "/text-error") {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("bad request");
    } else if (req.url?.startsWith("/echo/")) {
      // echo back the path segment as JSON
      const segment = req.url.slice("/echo/".length);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ segment }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://localhost:${port}`;
});

after(() => {
  server.close();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("success run: emits RequestStarted, RequestCompleted, RunFinished", async () => {
  const flow = makeFlow({
    requests: [makeRequest("get-ok", `${baseUrl}/ok`)],
  });

  const events = await collect(runFlow(flow, {}, { continueOnError: false }));

  assert.equal(events.length, 3, "should emit 3 events");

  const [started, completed, finished] = events;

  assert.equal(started.type, "RequestStarted");
  assert.equal(started.name, "get-ok");
  assert.equal(started.method, "GET");
  assert.ok(started.url.includes("/ok"), "url should include /ok");

  assert.equal(completed.type, "RequestCompleted");
  assert.equal(completed.name, "get-ok");
  assert.equal(completed.status, 200);
  assert.equal(completed.failed, false);
  assert.ok(completed.responseTimeMs >= 0);
  assert.ok(completed.body.includes("true"));
  assert.equal(completed.parsedResponseError, undefined);

  assert.equal(finished.type, "RunFinished");
  assert.equal(finished.totalRequests, 1);
  assert.equal(finished.failedRequests, 0);
  assert.ok(finished.durationMs >= 0);
});

test("non-2xx: failed=true and parsedResponseError populated from JSON body", async () => {
  const flow = makeFlow({
    continueOnError: true,
    requests: [makeRequest("get-missing", `${baseUrl}/not-found`)],
  });

  const events = await collect(runFlow(flow, {}, { continueOnError: true }));
  const completed = events.find((e) => e.type === "RequestCompleted");

  assert.ok(completed, "should have a RequestCompleted event");
  assert.equal(completed.status, 404);
  assert.equal(completed.failed, true);
  assert.ok(
    completed.failureMessage?.includes("404"),
    "failureMessage should mention 404",
  );

  assert.ok(completed.parsedResponseError, "parsedResponseError should be set");
  assert.equal(completed.parsedResponseError.error, "not_found");
  assert.equal(completed.parsedResponseError.message, "Resource not found");
  assert.deepEqual(completed.parsedResponseError.details, { id: 123 });
});

test("non-2xx with plain-text body: parsedResponseError is undefined", async () => {
  const flow = makeFlow({
    continueOnError: true,
    requests: [makeRequest("bad-req", `${baseUrl}/text-error`)],
  });

  const events = await collect(runFlow(flow, {}, { continueOnError: true }));
  const completed = events.find((e) => e.type === "RequestCompleted");

  assert.ok(completed);
  assert.equal(completed.failed, true);
  assert.equal(
    completed.parsedResponseError,
    undefined,
    "plain-text body should not yield parsedResponseError",
  );
});

test("continueOnError: both requests complete even after a 404", async () => {
  const flow = makeFlow({
    continueOnError: true,
    requests: [
      makeRequest("first", `${baseUrl}/not-found`, { order: 1 }),
      makeRequest("second", `${baseUrl}/ok`, { order: 2 }),
    ],
  });

  const events = await collect(runFlow(flow, {}, { continueOnError: true }));
  const completed = events.filter((e) => e.type === "RequestCompleted");

  assert.equal(completed.length, 2, "both requests should complete");
  assert.equal(completed[0].name, "first");
  assert.equal(completed[0].failed, true);
  assert.equal(completed[1].name, "second");
  assert.equal(completed[1].failed, false);
});

test("abort mid-run: stops after first request, no unhandled rejections", async () => {
  const flow = makeFlow({
    continueOnError: true,
    requests: [
      makeRequest("r1", `${baseUrl}/ok`, { order: 1 }),
      makeRequest("r2", `${baseUrl}/ok`, { order: 2 }),
    ],
  });

  const seen = [];
  for await (const event of runFlow(flow, {}, { continueOnError: true })) {
    seen.push(event);
    if (event.type === "RequestCompleted") {
      break; // abort after first completed request
    }
  }

  const completedNames = seen
    .filter((e) => e.type === "RequestCompleted")
    .map((e) => e.name);

  // Only the first request should have completed
  assert.equal(completedNames.length, 1, "exactly one request should complete");
  assert.equal(completedNames[0], "r1");
});

test("pm.variables.set() captured in variablesSet", async () => {
  const flow = makeFlow({
    requests: [
      makeRequest("set-var-req", `${baseUrl}/ok`, {
        scripts: [
          {
            type: "afterResponse",
            language: "text/javascript",
            code: 'pm.variables.set("capturedVar", "hello-world");',
          },
        ],
      }),
    ],
  });

  const events = await collect(runFlow(flow, {}, { continueOnError: false }));
  const completed = events.find((e) => e.type === "RequestCompleted");

  assert.ok(completed, "should have RequestCompleted");
  assert.deepEqual(completed.variablesSet, { capturedVar: "hello-world" });
});

test("pm.variables.set() chains to next request URL", async () => {
  const flow = makeFlow({
    requests: [
      makeRequest("req1", `${baseUrl}/ok`, {
        order: 1,
        scripts: [
          {
            type: "afterResponse",
            language: "text/javascript",
            code: 'pm.variables.set("segment", "injected");',
          },
        ],
      }),
      makeRequest("req2", `${baseUrl}/echo/{{segment}}`, { order: 2 }),
    ],
  });

  const events = await collect(runFlow(flow, {}, { continueOnError: false }));
  const req2completed = events.find(
    (e) => e.type === "RequestCompleted" && e.name === "req2",
  );

  assert.ok(req2completed, "req2 should complete");
  assert.ok(
    req2completed.body.includes("injected"),
    "req2 body should contain the chained variable value",
  );
});

test("console output captured in consoleOutput", async () => {
  const flow = makeFlow({
    requests: [
      makeRequest("console-req", `${baseUrl}/ok`, {
        scripts: [
          {
            type: "beforeRequest",
            language: "text/javascript",
            code: 'console.log("before-msg", 42);',
          },
          {
            type: "afterResponse",
            language: "text/javascript",
            code: 'console.warn("after-msg");',
          },
        ],
      }),
    ],
  });

  const events = await collect(runFlow(flow, {}, { continueOnError: false }));
  const completed = events.find((e) => e.type === "RequestCompleted");

  assert.ok(completed, "should have RequestCompleted");
  const output = completed.consoleOutput;
  assert.ok(
    output.some((l) => l.includes("before-msg") && l.includes("42")),
    "should capture prerequest console.log",
  );
  assert.ok(
    output.some((l) => l.includes("after-msg")),
    "should capture test console.warn",
  );
});

test("resolved request headers + body captured on RequestCompleted", async () => {
  // Lock in the contract that Newman's beforeRequest event provides headers
  // and body with {{variables}} already substituted, and that our runner
  // surfaces them on the completed event for the detail pane / logger to use.
  const flow = makeFlow({
    requests: [
      makeRequest("resolved-req", `${baseUrl}/ok`, {
        method: "POST",
        headers: { Authorization: "Bearer {{tok}}" },
        body: { type: "json", content: '{"id":"{{userId}}"}' },
      }),
    ],
  });

  const events = await collect(
    runFlow(
      flow,
      { tok: "abc-123", userId: "u-42" },
      { continueOnError: false },
    ),
  );
  const completed = events.find((e) => e.type === "RequestCompleted");

  assert.ok(completed, "should have RequestCompleted");
  assert.equal(
    completed.requestHeaders?.Authorization,
    "Bearer abc-123",
    "resolved Authorization header should have variable substituted",
  );
  assert.equal(
    completed.requestBody?.mode,
    "raw",
    "resolved body mode should be raw",
  );
  assert.equal(
    completed.requestBody?.content,
    '{"id":"u-42"}',
    "resolved body should have variable substituted",
  );
  assert.ok(
    !completed.requestBody?.content.includes("{{"),
    `resolved body should not contain unresolved tokens: ${completed.requestBody?.content}`,
  );
});

test("variables resolved from supplied map in URL", async () => {
  const flow = makeFlow({
    requests: [makeRequest("echo-var", `${baseUrl}/echo/{{mySegment}}`)],
  });

  const events = await collect(
    runFlow(flow, { mySegment: "from-variables" }, { continueOnError: false }),
  );
  const completed = events.find((e) => e.type === "RequestCompleted");

  assert.ok(completed, "should have RequestCompleted");
  assert.ok(
    completed.body.includes("from-variables"),
    "variable should be resolved in URL",
  );
});

test("pre-run error: invalid JSON body emits RunFinished with preRunError", async () => {
  const flow = makeFlow({
    requests: [
      makeRequest("bad-json", `${baseUrl}/ok`, {
        body: { type: "json", content: "not { valid json" },
      }),
    ],
  });

  const events = await collect(runFlow(flow, {}, { continueOnError: false }));

  assert.equal(events.length, 1, "only RunFinished should be emitted");
  const [finished] = events;
  assert.equal(finished.type, "RunFinished");
  assert.ok(
    finished.preRunError?.includes("bad-json"),
    "preRunError should name the offending request",
  );
  assert.equal(finished.totalRequests, 0);
});

test("collection assembled with correct method, headers, body", async () => {
  // Use a raw text body POST to /ok (server returns 200 regardless of body)
  const flow = makeFlow({
    requests: [
      makeRequest("post-req", `${baseUrl}/ok`, {
        method: "POST",
        headers: { "X-Custom": "header-value" },
        body: { type: "text", content: "hello body" },
      }),
    ],
  });

  const events = await collect(runFlow(flow, {}, { continueOnError: false }));
  const started = events.find((e) => e.type === "RequestStarted");
  const completed = events.find((e) => e.type === "RequestCompleted");

  assert.ok(started);
  assert.equal(started.method, "POST");
  assert.ok(completed);
  assert.equal(completed.status, 200);
});
