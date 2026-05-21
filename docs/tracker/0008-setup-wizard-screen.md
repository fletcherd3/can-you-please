# setup wizard screen

**labels:** needs-triage

## What to build

Implement the setup wizard screen: the first thing a new user sees,
and the recovery surface when the configured workspace path is
invalid. Offers two paths — point at an existing collection repo,
or scaffold a new one.

End-to-end: a new user runs `can-you-please`, sees the wizard,
types a path (with live sub-directory suggestions and `tab`
completion), selects "point me at an existing repo", presses enter,
and is taken to the flow picker. A second user chooses "scaffold a
new one", fills in a parent dir and name, and the app creates the
directory tree with an example flow and immediately proceeds to the
flow picker.

## Acceptance criteria

- [ ] Wizard renders on first launch (no config) and when the
      configured workspace path fails `isValidWorkspace()`
- [ ] Broken-path pre-fill: when re-entering due to invalid path,
      the directory input is pre-filled with the broken path and
      the validation error is shown inline
- [ ] Directory input: typing filters a live dropdown of matching
      sub-directories; `tab` completes the longest common prefix;
      `~` expands to `os.homedir()`
- [ ] Two options clearly presented: "point me at an existing
      collection repo" and "scaffold a new one"
- [ ] **Existing repo path**: validates with `isValidWorkspace()`;
      inline error if invalid; on success writes config and
      transitions to `flow-picker`
- [ ] **Scaffold new**: parent dir input + name field (default
      `can-you-please-collection`); creates directory tree:
      `postman/collections/<name>/`, `postman/environments/`,
      `postman/globals/`; writes an example `*.request.yaml`,
      `definition.yaml`, and `dev.environment.yaml`; writes config;
      transitions to `flow-picker`
- [ ] Scaffolded workspace passes `isValidWorkspace()` immediately
- [ ] Inline validation errors do not clear the input or leave
      the screen
- [ ] Footer shows relevant hotkeys: `tab complete · esc back · enter confirm`

## Blocked by

- [0007 app shell & screen state machine](./0007-app-shell-and-screen-state-machine.md)
- [0002 workspace loader](./0002-workspace-loader.md)
