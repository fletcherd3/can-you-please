# flow picker screen

**labels:** needs-triage

## What to build

Implement the flow picker screen — the root screen users land on
after setup. Includes the reusable `FilterableList` component, which
is also consumed by the env picker.

End-to-end: a user sees all valid flows grouped under section
headers, types letters to filter the list, presses `e` to filter
by environment, presses `enter` to select a flow, and is taken to
the next screen. Broken flows appear dimmed and non-selectable.

## Acceptance criteria

- [ ] `FilterableList` component in `src/ui/components/` — renders
      a scrollable list with optional group section headers, type-
      to-filter always on, arrow-key navigation, orange accent on
      selected row
- [ ] Flows grouped under section headers; ungrouped flows at top
      with no header; ordering per PRD (order asc → alpha within
      group; groups alpha)
- [ ] Each row: status/spinner glyph · flow name ` — ` dimmed
      description (truncated with `…` if needed)
- [ ] Broken flows: red `!` glyph, dimmed, not selectable; pressing
      enter on a broken flow shows the error inline
- [ ] Duplicate-name flows: warning glyph, still selectable
- [ ] Filter status row above list:
      `env: <name> · group: <name> · N of M flows` (omits inactive
      filters)
- [ ] `e` key opens env-filter overlay (filterable list of envs);
      selecting one sets the active env filter
- [ ] `g` key opens group-filter overlay (filterable list of
      groups); selecting one sets the active group filter
- [ ] `esc` clears active text filter first; second `esc` exits to
      root (quit)
- [ ] Zero-results state: `nothing here, sorry!` with hint to
      clear filters
- [ ] `shift-R` reloads the workspace from disk and re-renders
- [ ] Selecting a valid flow transitions to `env-picker` (or
      skips per env-picker logic)
- [ ] Footer hints: `↑↓ nav · e env · g group · R reload · ? help`

## Blocked by

- [0008 setup wizard screen](./0008-setup-wizard-screen.md)
- [0002 workspace loader](./0002-workspace-loader.md)
