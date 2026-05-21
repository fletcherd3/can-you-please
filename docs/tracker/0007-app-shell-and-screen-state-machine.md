# app shell & screen state machine

**labels:** needs-triage

## What to build

Implement the Ink root component (`src/app.tsx`) and the screen
state machine that drives transitions between screens. Screens are
dumb — they take props and emit events; `app.tsx` owns all
transition logic.

End-to-end: running `can-you-please` launches an Ink app. With no
config it renders a placeholder "setup" screen. `ctrl+c` anywhere
hard-quits. `q` from the root screen quits. The shell compiles and
the named screen states are wired up (even if each screen is just a
stub `<Text>` for now).

## Acceptance criteria

- [ ] `src/app.tsx` renders the active screen component based on
      a discriminated-union screen state
- [ ] Screen states defined: `setup-wizard`, `flow-picker`,
      `env-picker`, `variables-form`, `run-view`
- [ ] On launch: reads config via `readConfig()`; routes to
      `setup-wizard` if null or workspace path is invalid,
      otherwise to `flow-picker`
- [ ] `ctrl+c` registers a global `SIGINT` handler that exits 0
      (cancels any in-flight run cleanly before exiting)
- [ ] `q` on `flow-picker` exits 0
- [ ] `esc` on any non-root screen transitions back one step in
      the screen stack
- [ ] Each screen slot renders a clearly-labelled stub component
      (e.g. `<Text>flow picker — coming soon</Text>`) so the shell
      is immediately runnable
- [ ] `src/bin.ts` Node version check fires before Ink renders
- [ ] `?` keypress registered globally and routes to help overlay
      state (overlay can be a stub for now)

## Blocked by

- [0001 project scaffolding](./0001-project-scaffolding.md)
- [0006 config persistence](./0006-config-persistence.md)
