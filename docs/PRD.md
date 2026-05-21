# PRD: can-you-please

A friendly TUI for running multi-step API flows against named
environments, sourced from a developer's own git-managed Collection 3
repo.

## Problem statement

Engineers regularly need to run repeatable, multi-step API tasks
against internal services — creating test users, provisioning cards,
seeding data, kicking off back-office workflows.

Today those tasks live as Postman collections inside the Postman
desktop app, which is heavyweight, graphical-only, and produces
verbose JSON output that's hard to scan. Sharing means
exporting/importing or sharing a Postman workspace.

The previous version of this tool (`cyp` v1) replaced Postman with a
flag-driven CLI. That fixed the *Postman* problem but introduced new
friction: long invocations, flying-past stdout that couldn't be
scrolled, and fuzzy-string env selection.

Engineers want the *automation* of Postman without the *Postman*, and
the *discoverability* of a UI without the *UI*.

## Design principle

Above all else, the app should be a delight to use — a TUI that
doesn't take itself too seriously. This is a tone goal, not a feature:
it should never be stated to the user, only felt — through copy,
motion, responsiveness, hotkeys, and the small touches between
screens.

Concretely:

- **Copy** is lowercase, plain, friendly-casual. Never lossy on facts:
  `something went wrong on request 3 of 7 — 500 from POST /users`,
  not `oh no — it didn't work :(`.
- **Motion** is minimal: a spinner glyph on the running request row,
  a top progress bar in the run view. No screen transitions.
- **Hotkey discoverability** lives in a one-row dimmed footer on every
  screen showing the 3-5 most relevant keys; full reference in `?`.
- **No easter eggs.** The name is the joke; the rest of the app is
  the straight man.
- **Theme accent is orange** (ANSI 256:208), used for the active
  selection, focused field, primary action key, and run-view progress
  bar. Semantic colours (red/green/dim) stay semantic. Light/dark
  variants are deferred.

## Solution

`can-you-please` is a Node terminal UI, built with Ink, that runs
flows from a Collection 3 repo — a plain git repo containing YAML
request, environment and globals files under `postman/` — using
Newman under the hood (see ADR 0002).

The user runs `can-you-please` from any terminal. There are no
subcommands. No `cyp` alias — the full name is the joke and aliasing
breaks it.

### Screen flow

```
              ┌──────────────────┐
              │   setup wizard   │   first launch, or via ?
              └────────┬─────────┘
                       ↓
              ┌──────────────────┐
              │   flow picker    │   (root)
              └────────┬─────────┘
                       ↓
              ┌──────────────────┐
              │   env picker     │   skipped if flow has 0 or 1 envs
              └────────┬─────────┘
                       ↓
              ┌──────────────────┐
              │ variables form   │   skipped if flow references 0 vars
              └────────┬─────────┘
                       ↓
              ┌──────────────────┐
              │    run view      │   detail pane togglable
              └──────────────────┘
```

`esc` always means "back one screen". `q` quits from the flow picker
and is `esc`-equivalent elsewhere. `ctrl+c` is hard quit anywhere and
cancels an in-flight run.

### Setup wizard

Reachable on first launch (no config file), on launch when the
configured workspace path is no longer valid (with the broken path
pre-filled and the validation error inline), and from the `?` overlay's
actions list any time.

The wizard offers two options:

- **point me at an existing collection repo** — directory input with
  a live dropdown of matching subdirectories as the user types, plus
  `tab` to complete the longest common prefix. `~` expands to home.
- **scaffold a new one** — same directory input for a parent dir, plus
  a name field defaulting to `can-you-please-collection`. The app
  creates the directory tree, an example flow, one environment, one
  globals file, then configures itself against the new path. Result is
  immediately runnable so the user sees the app working end-to-end.

A workspace is **valid** iff:

- `postman/collections/` contains at least one **valid flow** (= a
  leaf folder with ≥1 `*.request.yaml` and a parseable
  `definition.yaml`),
- `postman/environments/` contains at least one parseable
  `*.environment.yaml`,
- `postman/globals/` may be absent or empty.

Validation errors are rendered inline so the user can fix without
leaving the screen.

For r1 the wizard configures only the workspace path. Other knobs
(log dir, theme) have sensible defaults and are out of scope.

### Flow picker

Lists every valid flow in the workspace, with grouped flows under
section headers and ungrouped flows at the top with no header. Within
a group: order by `order` ascending then alphabetical. Between groups:
alphabetical by group name (authors who want a specific group order
prefix the name, e.g. `1-user-flows`).

Each row: optional spinner/status glyph · flow name · ` — ` · dimmed
description (truncated with `…` if needed).

A footer-ish row above the list shows active filter state and counts:
` env: sand · group: user-flows · 4 of 17 flows`.

Filter behaviour:

- **Type-to-filter** is always on. Typing letters filters the list;
  arrow keys still navigate. `esc` clears the filter; a second `esc`
  exits the screen.
- **`e`** opens an environment-filter overlay. While a filter is
  active, only flows whose `environments` list includes the filtered
  env (or whose `environments` field is absent — absent means "runs
  anywhere") are shown.
- **`g`** opens a group-filter overlay.
- **shift-R** reloads the workspace from disk.

Selecting a flow advances to the env picker (or skips to the next
applicable screen).

### Environment picker

The env picker is **skipped** when a flow declares zero or one
environments — in the zero case the user picks from every workspace
env on the next screen … wait, scratch that. Concretely:

- Flow declares **one** env → skip picker, that env is selected.
- Flow declares **multiple** → show picker filtered to those.
- Flow declares **none** → show picker with every workspace env.

The picker is the same `FilterableList` shape as the flow picker.

If the flow-picker env-filter was active, the corresponding env is
pre-selected when the picker is shown.

### Variables form

The set of variables for a flow is **auto-detected** by scanning every
`{{name}}` token in the flow's request URLs, headers and bodies. The
flow's `definition.yaml` annotates that set:

- `requires: [name1, name2]` — must be non-empty before run.
- `enums: { var: [opt1, opt2] }` — quick-pick suggestions.
- `variables: { var: defaultValue }` — Postman-style default values.

A variable's value resolves at run time (lowest precedence first):

```
flow defaults  <  globals  <  environment  <  form input  <  pm.variables.set()
```

The form renders two visual sections:

- **required** at the top, always visible. Submitting with any
  required field blank focuses the first blank field.
- **optional** below, always visible but de-emphasised.

Each field is a hybrid combobox: type free-form text, or arrow into
the suggested-values dropdown for variables that declare an `enums`
entry. Enum values are suggestions, never constraints — the user can
always type their own. Default values pre-fill the field, regardless
of whether they appear in the enum list.

The form footer hosts the **`continue on error` toggle**, which
defaults to whatever the flow's `definition.yaml` declares (default
`false`). The `c` hotkey toggles it.

If the flow references zero variables the form is skipped entirely.
The `continue on error` value is then whatever the `definition.yaml`
declares; the live mid-run toggle still works.

### Run view

Split-pane layout. Request list on the left, detail pane on the right.
The detail pane is hidden by default while the run is in progress;
`tab` toggles it.

Each request row shows:

```
✓  POST   201   142ms   create user           💬
✗  GET    500   893ms   fetch otp
⋯  POST    —     —      send notification
```

- status glyph (`✓` pass, `✗` fail, `⋯` pending, `▶` running, `—`
  skipped/cancelled)
- method · status code · duration · request name
- `💬` indicator on rows whose scripts produced `console.log` output

Failed rows render in red, pending dim, success default, running with
the spinner glyph and orange accent.

A top progress bar tracks `n/m requests`. The bottom footer hints at
keys: `↑↓ nav · tab detail · c continue · d details · esc cancel`.

Selection follows the running request automatically until the user
presses `↑`/`↓`, at which point selection detaches; pressing `f`
re-attaches.

The detail pane, for the selected request, scrollably shows:

1. Request: method, fully-resolved URL, final headers, body
2. Response: status, duration, headers, body (JSON pretty-printed)
3. `console.log` output from `beforeRequest` / `afterResponse` scripts
4. Variables set via `pm.variables.set` during this request
5. On failure: the parsed `error` / `message` / `details` summary

A "failure" is **any** of: network error, non-2xx response,
test-script assertion failure, script exception. The runner
synthesises non-2xx as failures explicitly (Newman's native `--bail`
only fires on script-level failures).

### Cancellation, retry, re-run

- **`esc`** mid-run cancels the run via `run.abort()` and stays on the
  run view showing partial results. Pending requests render as
  cancelled. A second `esc` returns to the flow picker.
- **`r`** post-run re-runs with the same variables. The workspace is
  reloaded from disk first so the user's mid-session edits take
  effect.
- The variables form is **not** revisited on `r`. To change vars, the
  user `esc`s back to the form.
- Only one run at a time.

### Logging

Every run writes a single plain-text log file under
`~/.config/can-you-please/logs/` (configurable later) named:

```
2025-05-21_14-23-04_user-flows__create-user_fail.log
```

- Sortable timestamp (date `_` time, `:` replaced with `-`).
- Group and flow joined with `__` (group separator — flow names may
  contain `-`).
- Suffix `_pass` or `_fail`.

Each request inside the file is delimited by a header
`=== request 1/3: create user (POST 201, 142ms) ===` and includes
timestamp, fully-resolved request, response, script console output,
variables set by scripts, and on failure the parsed error summary.
Bodies are truncated at 1MB with `[truncated, original size: N
bytes]`.

The detail pane is the primary debugging surface; the log file is the
post-mortem one. The `?` overlay's actions list shows the log
directory path so the user can open it themselves.

### Hotkey scheme

Same key, same meaning everywhere:

| Key | Meaning |
|---|---|
| `↑` `↓` (also `j` `k`) | Navigate list / form |
| `←` `→` (also `h` `l`) | Move within input / switch sections |
| `enter` | Confirm / activate / run |
| `esc` | Back one screen; cancel run mid-run |
| `q` | Quit from flow picker; `esc`-equivalent elsewhere |
| `ctrl+c` | Hard quit; cancels in-flight run |
| `tab` | Toggle detail pane (run view); cycle focus (forms) |
| `e` | Env-filter overlay (flow picker) |
| `g` | Group-filter overlay (flow picker) |
| `c` | Toggle continue-on-error (form, run view) |
| `d` | Jump to detail pane on selected/failed request (run view) |
| `f` | Re-attach selection to running request (run view) |
| `r` | Re-run last flow with same vars (post-run) |
| shift-R | Reload workspace from disk (flow picker) |
| `?` | Help / actions overlay |

Type-to-filter is always on for lists; letters enter the filter
without a leader key.

### Help overlay (`?`)

Two sections:

- **keys** — read-only reference of the current screen's bindings.
- **actions** — selectable list with `↑↓` + `enter`:
  - change workspace (re-enters setup wizard)
  - show log directory path (prints to footer)
  - show current workspace path (prints to footer)
  - quit

`?` or `esc` closes.

## Collection 3 workspace shape

A Collection 3 repo is a plain git repo with a top-level `postman/`
directory. Real-world repos also contain `postman/mocks/`,
`postman/specs/` and `postman/flows/` — those are Postman-IDE
artefacts and the app ignores them. Only three subdirectories matter:

```
postman/
  collections/        flows (flat — one folder per flow, no nesting)
  environments/       *.environment.yaml
  globals/            *.globals.yaml (workspace.globals.yaml preferred)
```

### Flows

Each leaf folder under `collections/` containing one or more
`*.request.yaml` files is a flow. **Folders under `collections/` are
flat** — there are no group folders (see ADR 0001). A flow's group
membership is encoded in its `definition.yaml` `name` field as
`group/flow`; the on-disk folder may have any name (Postman strips
`/` to a separator when writing to disk; the YAML `name` is the
source of truth).

Inside a flow folder:

- **`*.request.yaml`** — one file per request:

  ```yaml
  $kind: http-request
  url: https://{{base}}/users
  method: POST
  headers:
    Content-Type: application/json
  body:
    type: json                # or: text
    content: |-
      { "firstName": "{{first-name}}" }
  scripts:
    - type: afterResponse
      language: text/javascript
      code: pm.variables.set("user-id", pm.response.json().id)
  order: 1000
  ```

  Body types `json` and `text` are supported in r1; other types
  (`formdata`, `urlencoded`, `file`, `graphql`) are out of scope.
  `json` bodies are JSON-validated at workspace load.

- **`.resources/definition.yaml`** — flow metadata:

  ```yaml
  $kind: collection
  name: user-flows/create user      # required; "group/flow" or "flow"
  description: create a test user   # optional, shown in flow picker
  order: 1000                       # optional, picker ordering
  environments: [dev, sand]         # optional; absent = runs anywhere
  continueOnError: false            # optional, default false
  variables:                        # optional, default values
    base: api.example.com
  requires: [first-name, email]     # optional, required var names
  enums:                            # optional, quick-pick suggestions
    product: [zip-pay, zip-money]
  ```

`$kind` markers are validated when present; if wrong, the flow is
marked broken. If absent, the file is accepted (lenient default for
hand-authored YAML).

### Environments and globals

`postman/environments/*.environment.yaml`:

```yaml
name: dev
values:
  - { key: base, value: dev-api.example.com, enabled: true }
```

`postman/globals/*.globals.yaml` has the same shape.
`workspace.globals.yaml` is preferred when present.

The picker matches environments by **file basename** (`dev.environment.yaml`
→ `dev`), not the inner `name` field.

### Scripts

Scripts run inside Newman's default sandbox with full access to the
`pm.*` API. **`require()` is not available** — Postman's sandbox
behaviour is the unsurprising default and protects against nothing in
this context (the user is running their own scripts from their own
repo); v1 users porting flows that relied on `require` will need to
inline the dependency.

## Edge cases

- **Workspace becomes invalid mid-session** (e.g. configured path
  deleted) — next launch falls into the setup wizard with the broken
  path pre-filled and inline error.
- **Filter combo matches zero flows** — list area shows
  `nothing here, sorry!` with a hint to clear filters.
- **Malformed YAML in a flow** — flow is marked broken (red `!`,
  dimmed, not selectable). Other flows still work. The error is shown
  on attempt to select.
- **Two flows with the same `name`** — both load and render with a
  warning glyph and tooltip pointing at the other folder.
- **`order` collisions** — alphabetical-by-name tiebreaker. No
  warning.
- **Empty workspace after first launch** — treated as failed
  validation; setup wizard.

## Implementation shape

```
src/
├── bin.ts                # entrypoint
├── app.tsx               # Ink root, screen-state machine
├── workspace/            # config, load, validate, types
├── variables/            # detect, merge
├── runner/               # newman wrapper, reducer, failure synthesis
├── logger/               # file naming + per-run writer
├── ui/
│   ├── screens/          # one component per screen, dumb (props in / events out)
│   ├── components/       # FilterableList, EnumInput, DetailPane, etc.
│   └── hooks/
└── domain.ts
test/
├── fixtures/workspace/   # ungrouped, grouped, broken, single-env, vars+enums
└── e2e/                  # spawn the bin against a local HTTP server
```

- **Screens are dumb.** `app.tsx` holds the screen graph and dispatches
  transitions; screens take props and emit events.
- **Newman runner exposes events as an `AsyncIterable<RunEvent>`.** The
  run-view consumer iterates and reduces; cancellation is `break`.
- **Tests:** `node:test`, fixture-driven for the loader and merge
  logic, `ink-testing-library` for critical UI behaviours, e2e against
  a real local HTTP server (no nock/MSW).

## Distribution

- Published to npm as **`can-you-please`** (unscoped, public). If the
  name is taken, fall back to a personal scope.
- Single bin: `can-you-please`. No `cyp` alias.
- TypeScript source, compiled to `dist/` with `tsc`. No bundler.
- `engines: { node: ">=22" }`. Hard-fail with a clear message on
  older Node.
- MIT license.

## Out of scope (r1)

- Authoring or editing flows from inside the app. Flows are authored
  as YAML in the user's own repo (with or without Postman's help) and
  committed via normal git.
- Headless / CLI mode. The binary refuses to do anything useful in a
  non-TTY context. A scriptable mode is a likely v2 feature.
- Subcommands and the `cyp` alias.
- In-app self-update. Users update via npm.
- Multi-workspace support.
- Secrets management beyond what Postman environments offer (no
  masked input, no log redaction).
- Group-level variable defaults (globals cover the use case; group is
  just a name).
- Light/dark theme variants. Orange accent only.
- Persisting form values, last selection, or filter state across
  invocations.
- Auto-watching the workspace for changes (manual `shift-R` reload
  only).
- `require()` in flow scripts.
- Body types beyond `json` and `text`.

## Further notes

The cyp v1 backlog — auto-detecting required variables (partly
addressed here), version staleness warnings, defaulting `name`/`email`
from `whoami` / `ARTIFACTORY_USER`, auto-opening URLs from flow
output, BAU/production safety, team-vs-personal "spaces" — is
archived under `.me/docs/` and intentionally not part of r1. Several
of those become natural fits once the TUI exists and are expected to
land in subsequent releases.
