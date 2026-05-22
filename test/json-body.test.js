/**
 * Unit tests for the JSON body validator that tolerates unresolved
 * Postman template tokens (e.g. `{{var_x}}`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { isValidJsonBody } from "../dist/workspace/json-body.js";

test("accepts plain valid JSON", () => {
  assert.equal(isValidJsonBody('{"a":1}'), true);
});

test("accepts quoted Postman template tokens", () => {
  assert.equal(isValidJsonBody('{"id":"{{var_id}}"}'), true);
});

test("accepts unquoted Postman template tokens in array position", () => {
  assert.equal(
    isValidJsonBody('{"consumerIds":[{{var_consumer_id}}]}'),
    true,
  );
});

test("accepts unquoted Postman template tokens in value position", () => {
  assert.equal(isValidJsonBody('{"count":{{var_count}}}'), true);
});

test("accepts $randomUUID and similar dynamic vars", () => {
  assert.equal(
    isValidJsonBody('{"requestId":"{{$randomUUID}}"}'),
    true,
  );
});

test("rejects genuine JSON syntax errors", () => {
  assert.equal(isValidJsonBody("not { valid json"), false);
});

test("rejects JSON with trailing comma", () => {
  assert.equal(isValidJsonBody('{"a":1,}'), false);
});
