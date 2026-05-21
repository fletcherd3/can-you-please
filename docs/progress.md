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

### 0008 — setup wizard screen
_commit ca708eb_

- `SetupWizardScreen` in `src/ui/screens/SetupWizardScreen.tsx`:
  three-step flow — `mode-select`, `existing-path`,
  `scaffold-config`
- `brokenPath` prop: starts on `existing-path` step,
  pre-fills input, shows inline validation error
- directory input: live sub-directory suggestions via
  `readdir`, tab-completes the longest common prefix,
  `~` expands to `os.homedir()`
- two modes clearly presented; `↑↓ + enter` navigates;
  `esc` goes back one step
- existing repo: validates with `isValidWorkspace()`,
  inline error if invalid; writes config and calls
  `onDone` on success
- `scaffoldWorkspace(parentDir, name)` in
  `src/workspace/scaffold.ts`: creates
  `postman/collections/example-flow/`,
  `postman/environments/`, `postman/globals/`,
  example request + definition + dev env YAML
- scaffolded workspace passes `isValidWorkspace()`
  immediately
- `app.tsx` updated to forward `brokenPath` to
  `SetupWizardScreen` when configured path is invalid
- footer hotkeys on every step
- 22 new tests (UI + scaffold integration); 116 total;
  lint clean

### 0009 — flow picker screen
_commit cef2c3f_

- `FilterableList` component in `src/ui/components/FilterableList.tsx`:
  navigation (up/down/enter/esc), optional group section headers,
  orange `>` accent on selected row, zero-results
  "nothing here, sorry!" state
- `FlowPickerScreen` in `src/ui/screens/FlowPickerScreen.tsx`:
  type-to-filter always on (text filter via `useInput`),
  env filter overlay (`e` key), group filter overlay (`g` key),
  status row `env: <name> · group: <name> · N of M flows`,
  text filter indicator `/ <filter>█`, broken flow inline
  error on enter, duplicate flow `⚠` glyph, `shift-R` reload,
  `esc` clears filter then quits, footer hotkeys
- `OverlayPicker` sub-component: self-contained filterable list
  overlay for env/group selection, `✓` on active item
- `app.tsx` updated: passes `workspace` (not `flows`) +
  `onReload` callback to `FlowPickerScreen`
- 26 new tests (rendering, text filter, overlays, select,
  broken flow error, reload); all 142 tests pass; lint clean

### 0014 — npm distribution
_commit 47421f8_

- `package.json` publish fields completed: `keywords`, `author`,
  `repository`, `homepage`, `bugs` all populated
- `@types/react` and `ink-testing-library` moved to
  `devDependencies` (not needed at runtime)
- `.npmignore` created: excludes `src/`, `test/`, `docs/`, `.me/`,
  `*.md` (except root `README.md`), `tsconfig.json`, `eslint.config.js`,
  `.prettierignore`, `progress.txt`, `AGENTS.md`, `CONTEXT.md`
- `README.md` rewritten: covers what it is, `npm install -g` / `npx`
  install, Node ≥ 22 prerequisite, Collection 3 workspace prereq,
  quick-start, workspace layout, key bindings
- `LICENSE` file added (MIT, 2025 Fletcher Dick)
- `npm run build && npm publish --dry-run` passes; packed files are
  `LICENSE`, `README.md`, `dist/**`, `package.json` only (67 files)
- Node <22 hard-fail verified: simulated Node 20 prints error and
  exits 1
- all 142 tests pass; lint clean

### 0010 — env picker screen
_commit df6407e_

- `EnvPickerScreen` in `src/ui/screens/EnvPickerScreen.tsx`:
  shows all workspace envs when flow declares 0 environments;
  shows only declared envs when flow declares ≥2 environments;
  shows all envs for broken flows
- reuses `FilterableList` component; footer hints
  `↑↓ nav · enter select · esc back · ? help`
- `initialEnvId` prop pre-positions cursor to the env that
  matched the flow-picker env filter
- `FilterableList` updated with `initialIndex` prop
- `FlowPickerScreen.onSelect` now passes `activeEnvId` as
  second argument
- `app.tsx` updated: skips env-picker entirely when flow
  declares exactly one environment (auto-selects it); skips
  variables-form when flow has zero detected variables
  (goes straight to run-view)
- 13 new tests covering title, footer, env filtering, esc,
  enter-selects, pre-selection, help key; 155 total; lint clean

### 0011 — variables form screen
_commit 5863758_

- `EnumInput` component in `src/ui/components/EnumInput.tsx`:
  free-text input; arrow-down opens inline dropdown of
  enum suggestions; selecting fills the field; user can
  still type freely; esc closes dropdown
- `VariablesFormScreen` in
  `src/ui/screens/VariablesFormScreen.tsx`: two sections
  (`required` at top, `optional` below de-emphasised)
- field values pre-filled from `resolveVariables(flow, env,
  globals, {})` full five-layer merge
- `tab` / `shift-tab` cycle focus; `↑↓` navigate within
  open dropdown only
- submitting with blank required field focuses first blank,
  shows inline `required` error; other fields unblocked
- `c` key toggles continue-on-error; initial value from
  `flow.continueOnError`; label dimmed off / orange on
- `esc` calls `onBack`; `?` calls `onHelp`
- footer: `tab next · ↑↓ dropdown · c continue-on-error
  · enter run · esc back · ? help`
- `app.tsx` updated to pass `globals={workspace.globals}`
  to `VariablesFormScreen`
- 20 new tests (title, sections, pre-fill, tab, c-toggle,
  submit, required-error, dropdown open/select/esc);
  175 total; lint clean

### 0013 — help overlay
_commit TBD_

- `HelpOverlay` in `src/ui/screens/HelpOverlay.tsx`: full
  implementation replacing the coming-soon stub
- floating box with `borderStyle="round"` + orange border
- **keys section**: read-only; rendered when `keys` prop is
  non-empty; hides entirely when no keys supplied
- **actions section**: `↑↓` navigable with orange `>` accent
  on selected row; four actions:
  - `change workspace` — calls `onChangeWorkspace`
  - `show log directory` — shows `logDir` path in footer
  - `show workspace path` — shows `workspacePath` in footer
  - `quit` — calls `onQuit`
- footer: `↑↓ nav · enter select · esc close`; replaced by
  path string when a path action is executed
- `?` or `esc` closes the overlay
- `app.tsx` updated:
  - adds `LOG_DIR` constant (`~/.local/share/can-you-please/logs`)
  - `getScreenKeys(screenState)` derives per-screen key reference
    from the global PRD hotkey table (five screens covered)
  - `HelpOverlay` now receives `onChangeWorkspace`, `onQuit`,
    `workspacePath`, `logDir`, and `keys` props
  - `onChangeWorkspace`: closes overlay + routes to setup wizard
  - `onQuit`: `exit()` + `process.exit(0)`
  - `workspacePath` sourced from `screenState.workspace.rootPath`
    (undefined on setup-wizard screen)
- updated `app.test.js`: `HelpOverlay renders stub text` test
  updated to check for "help" and "actions"; esc/? close tests
  pass new required props
- 13 new tests in `help-overlay.test.js`: rendering, keys
  section visibility, navigation, all four actions, footer path
  display, fallback for missing workspacePath; 221 total; lint clean

### 0012 — run view screen
_commit 1cde850_

- `DetailPane` component in `src/ui/components/DetailPane.tsx`:
  scrollable lines; sections for request (method, URL, headers,
  body), response (status, duration, headers, JSON-pretty body),
  console output, variables set, failure summary
- `RunViewScreen` in `src/ui/screens/RunViewScreen.tsx`:
  split-pane layout — request list left, detail pane right
- request list rows: glyph · method · status · duration · name
  · `💬` when console output present
- glyphs: `✓` pass, `✗` fail (red), `⋯` pending (dim), `▶`
  running (orange spinner), `—` cancelled (dim)
- progress bar: `N/M requests`, orange fill, live updates
- auto-follow running request; `↑`/`↓` detaches; `f` re-attaches
- `tab` toggles detail pane; `d` jumps focus to detail
- detail pane auto-shown on run failure
- `esc` mid-run: aborts run, marks remaining cancelled, stays
  on run view; second `esc` returns to flow picker
- `r` post-run: reloads workspace from disk, re-runs same flow
- `c` key toggles continue-on-error
- run logger called on every event; `close()` on completion
- only one run at a time; `r` inactive while running
- footer hints differ during-run vs post-run
- `_runFlowFn` injection prop for test isolation
- fixed `app.test.js` `RunViewScreen` stub test: now passes an
  instant-completing `_runFlowFn` so ESC hits the post-run path
- 33 new tests in `run-view.test.js`; 208 total; lint clean
