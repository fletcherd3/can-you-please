# progress

## completed

### 0001 — project scaffolding
_commit c9f1852_

- created `package.json` (`name: can-you-please`, `engines: >=22`,
  `type: module`, `bin → dist/bin.js`)
- `src/bin.ts` guards against node <22 and prints stub message
- `tsconfig.json` targeting ESNext/NodeNext strict mode, outputs to
  `dist/`
- eslint (flat config) + prettier wired up; `npm run lint` passes
- `src/` and `test/` directory skeletons match PRD shape
  (`workspace/`, `variables/`, `runner/`, `logger/`,
  `ui/screens/`, `ui/components/`, `ui/hooks/`, `domain.ts`)
- `test/fixtures/workspace/` directory created (empty)
- placeholder `node:test` suite passes
- `.gitignore` excludes `node_modules/` and `dist/`
- all acceptance criteria in tracker 0001 satisfied

### 0002 — workspace loader
_commit dcf9314_

- defined all domain types in `src/domain.ts`: `Workspace`, `Flow`,
  `BrokenFlow`, `AnyFlow`, `Request`, `RequestBody`, `Script`,
  `Environment`, `Globals`, `EnvValue`
- `loadWorkspace(path)` in `src/workspace/index.ts`: walks
  `postman/collections/`, parses `*.request.yaml` + `.resources/definition.yaml`,
  parses environments and globals
- broken flows (malformed YAML, wrong `$kind`, missing name) included
  as `BrokenFlow` values — not thrown; other flows unaffected
- duplicate fully-qualified names flagged with `duplicateWarning` on
  both flows
- `isValidWorkspace(ws)` guard: true iff ≥1 valid flow and ≥1 env
- flows sorted: ungrouped first, then groups alphabetically; within
  each group by `order` asc then alphabetical by name
- five fixture workspaces: `ungrouped`, `grouped`, `broken-flow`,
  `single-env`, `vars-and-enums`
- 18 unit tests, all passing; lint clean
- `npm test` updated to `tsc && node --test`
- `yaml` package added as dependency

### 0003 — variable detection and merge
_commit e925998_

- `detectVariables(flow)` in `src/variables/index.ts`: scans every
  `{{name}}` token from request URLs, header values, and body content;
  returns `VariableMeta[]` (name, required, enums, defaultValue)
- `mergeVariables(layers)`: pure left-to-right merge; later layers win;
  JSDoc notes that `pm.variables.set()` is runtime-only, not merged here
- `resolveVariables(flow, env, globals, formInput)`: full pipeline in
  precedence order (flow defaults < globals < env < form); seeds
  required vars with `""` when absent from all layers
- disabled env/globals values (`enabled: false`) excluded from merge
- 25 new tests covering token scanning, metadata annotation, precedence,
  required-but-missing, `~`/`$` characters; all 43 tests pass; lint clean

### 0004 — newman runner
_commit 37a8deb_

- `runFlow(flow, variables, options)` in `src/runner/index.ts` returns
  `AsyncIterable<RunEvent>`
- builds Postman v2.1 collection from `Flow` requests (method, url,
  headers, body, scripts ordered by `order`)
- emits `RequestStarted` (on `beforeRequest`), `RequestCompleted`
  (on `item` — after all scripts run), `RunFinished` (on `done`)
- console output from pre/post scripts buffered per item and included
  in `RequestCompleted.consoleOutput`
- `pm.variables.set()` captured from `script` events; included in
  `RequestCompleted.variablesSet`; chains to subsequent requests
- non-2xx status synthesised as `failed: true`; JSON body parsed for
  `error`, `message`, `details` fields into `parsedResponseError`
- `continueOnError` maps to Newman `bail` option (inverse)
- breaking the async iterable calls `internalRun.abort()` cleanly
- pre-run JSON body validation: invalid body emits `RunFinished` with
  `preRunError` instead of starting Newman
- minimal ambient type declaration for `newman` in `src/newman.d.ts`
- `newman` added as runtime dependency
- 11 e2e tests against a local `node:http` server covering: success,
  non-2xx JSON and text errors, continueOnError, abort, variable
  capture, variable chaining, console capture, URL resolution,
  pre-run error; all 54 tests pass; lint clean

### 0005 — run logger
_commit acbdf82_

- `createRunLogger(flow, logDir)` in `src/logger/index.ts` returns
  a `RunLogger` (`write(event)` + `close(outcome)`)
- `write()` buffers one section per request by pairing
  `RequestStarted` with the following `RequestCompleted` event
- `close(outcome)` creates `logDir` if needed and writes the log
  under a timestamp-stamped filename
- filename format:
  `YYYY-MM-DD_HH-mm-ss_<group>__<flow>_<outcome>.log`;
  ungrouped flows omit the `<group>__` prefix
- each request section delimited by
  `=== request N/M: <name> (METHOD status, Nms) ===`
- section includes: ISO timestamp, resolved URL, request
  headers/body (from flow definition), response status,
  response headers, response body, console output,
  variables set, error detail on failure
- response bodies truncated at 1 MB with
  `[truncated, original size: N bytes]` marker
- `buildLogFilename`, `formatFileTimestamp`, `truncateBody`
  exported for unit testing
- 19 unit tests covering filename generation (grouped, ungrouped,
  pass/fail), truncation boundary (exact, over, multi-byte),
  directory creation, multi-request ordering, section content;
  all 73 tests pass; lint clean

### 0006 — config persistence
_commit db112a6_

- `AppConfig` type `{ workspacePath: string }` in `src/config.ts`
- `readConfig(): Promise<AppConfig | null>` — returns `null` when
  file absent, invalid JSON, or missing `workspacePath` key
- `writeConfig(patch: Partial<AppConfig>): Promise<void>` — merges
  patch into existing file, preserving unknown keys for
  forward-compatibility
- config stored at `~/.config/can-you-please/config.json`
- directory created automatically via `mkdir({ recursive: true })`
- atomic write: write to `tmpdir` temp file then `rename` into place
- 8 unit tests: missing file → null, invalid JSON → null, missing
  key → null, round-trip, dir creation, unknown-key preservation,
  overwrite, concurrent writes; all 81 tests pass; lint clean

### 0007 — app shell and screen state machine
_commit 292ec2d_

- added `ink`, `react`, `@types/react`, `ink-testing-library` deps
- updated `tsconfig.json` with `jsx: react-jsx`
- `src/app.tsx`: `ScreenState` discriminated union
  (`setup-wizard`, `flow-picker`, `env-picker`,
  `variables-form`, `run-view`); startup routing via
  `readConfig()` / `loadWorkspace()` / `isValidWorkspace()`;
  global SIGINT handler; global `?` key opens help overlay
- stub screen components: `SetupWizardScreen`,
  `FlowPickerScreen`, `EnvPickerScreen`,
  `VariablesFormScreen`, `RunViewScreen`, `HelpOverlay`
  (each renders labelled stub text)
- `src/bin.ts` updated to launch Ink `<App>` after node
  >=22 guard (guard fires synchronously before dynamic import)
- 13 new tests (ink-testing-library): stub rendering + `q`,
  `esc`, `?` keyboard interactions; 94 total tests pass
- lint clean

## next up

0008 — setup wizard screen
