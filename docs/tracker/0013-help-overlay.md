# help overlay

**labels:** needs-triage

## What to build

Implement the `?` help overlay — a modal that appears over any
screen, showing the active screen's key bindings and a selectable
actions list with app-level operations.

End-to-end: a user presses `?` on any screen; the overlay appears
with two sections — "keys" (read-only reference) and "actions"
(navigable list). They select "show log directory" and see the path
in the footer. They press `esc` or `?` to close.

## Acceptance criteria

- [ ] `?` opens the overlay from any screen; `esc` or `?` closes it
- [ ] **keys section**: read-only list of hotkeys relevant to the
      current screen (passed in as props from the screen); uses
      the global hotkey table from the PRD as base
- [ ] **actions section**: navigable with `↑↓` + `enter`:
      - "change workspace" — closes overlay and re-enters setup wizard
      - "show log directory" — prints path to the footer and closes
      - "show workspace path" — prints path to the footer and closes
      - "quit" — exits 0
- [ ] Overlay renders as a floating box (border + background) over
      the current screen content
- [ ] Footer inside overlay: `↑↓ nav · enter select · esc close`

## Blocked by

- [0007 app shell & screen state machine](./0007-app-shell-and-screen-state-machine.md)
