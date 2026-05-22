/**
 * Validate a JSON request body that may contain Postman template tokens
 * (e.g. `{{var_x}}`).
 *
 * Postman bodies routinely embed unquoted template tokens in JSON value
 * positions — `[{{var_consumer_id}}]`, `{ "n": {{var_count}} }` — which
 * are illegal JSON until the variables are resolved at run time. To
 * still catch genuine syntax errors at parse time we replace every
 * `{{ ... }}` token with the literal `0` (a valid JSON value) before
 * handing the result to `JSON.parse`.
 *
 * Returns `true` when the post-substitution string parses as JSON.
 */
export function isValidJsonBody(content: string): boolean {
  const stripped = content.replace(/\{\{[^}]*\}\}/g, "0");
  try {
    JSON.parse(stripped);
    return true;
  } catch {
    return false;
  }
}
