# env picker screen

**labels:** needs-triage

## What to build

Implement the env picker screen, which lets the user choose which
environment to run the selected flow against. Reuses the
`FilterableList` component from the flow picker.

End-to-end: a user selects a flow that declares multiple
environments, sees a list filtered to those environments, picks one
with arrow keys and enter, and proceeds to the variables form (or
run view). If the flow-picker env-filter was active the matching
env is pre-selected.

## Acceptance criteria

- [ ] Screen skipped entirely when the selected flow declares
      exactly one environment (that env is auto-selected)
- [ ] When flow declares zero environments, shows all workspace
      environments
- [ ] When flow declares multiple environments, shows only those
      environments
- [ ] Reuses `FilterableList` for the same look and navigation
      as the flow picker
- [ ] If the flow-picker env-filter was active when the flow was
      selected, that env is pre-selected (cursor positioned on it)
      when the picker opens
- [ ] `esc` returns to flow picker
- [ ] Selecting an environment transitions to `variables-form`
      (or skips to `run-view` if flow has zero variables)
- [ ] Footer hints: `↑↓ nav · enter select · esc back · ? help`

## Blocked by

- [0009 flow picker screen](./0009-flow-picker-screen.md)
