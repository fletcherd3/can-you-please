# newman runner

**labels:** needs-triage

## What to build

Implement the `runner/` module: assemble a Postman v2.1 collection
from a loaded `Flow`, run it through Newman with the resolved
variable map, and expose the results as an `AsyncIterable<RunEvent>`
so the run view can consume events incrementally. Synthesise
non-2xx responses as failures (Newman only fires script-level
failures natively).

End-to-end: `runFlow(flow, variables, options)` returns an async
iterable. The run view iterates it, receiving `RequestStarted`,
`RequestCompleted`, and `RunFinished` events. Breaking out of the
iterator cancels the Newman run via `run.abort()`.

## Acceptance criteria

- [ ] `runFlow(flow: Flow, variables: Record<string, string>,
      options: RunOptions): AsyncIterable<RunEvent>` in
      `src/runner/`
- [ ] Assembles a valid Postman v2.1 collection object from the
      flow's requests (method, url, headers, body, scripts);
      requests ordered by `order` field
- [ ] Passes `continueOnError` option to Newman (`bail` inverse)
- [ ] Emits `RequestStarted`, `RequestCompleted` (with timing,
      status, headers, body, console output, variables set), and
      `RunFinished` events
- [ ] Non-2xx response synthesised as a failure on the event (not
      just on Newman's script-level bail)
- [ ] `console.log` output from `beforeRequest` / `afterResponse`
      scripts captured and included in `RequestCompleted`
- [ ] Variables set via `pm.variables.set()` during a request
      captured and included in `RequestCompleted`
- [ ] Parsed `error` / `message` / `details` from failed response
      body included in `RequestCompleted` when present
- [ ] Breaking the async iterable calls `run.abort()` and the run
      stops cleanly (no unhandled rejections)
- [ ] `json` body content is JSON-validated before the run starts;
      invalid JSON emits a pre-run error event
- [ ] e2e tests spin up a local HTTP server (`node:http`) and run
      a real flow through the runner; covers: success, non-2xx
      failure, abort mid-run, `pm.variables.set()` chaining between
      requests

## Blocked by

- [0002 workspace loader](./0002-workspace-loader.md)
- [0003 variable detection & merge](./0003-variable-detection-and-merge.md)
