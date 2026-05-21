# run view screen

**labels:** needs-triage

## What to build

Implement the run view screen: the live and post-run display of a
flow execution. Split-pane layout — request list on the left, detail
pane on the right. Integrates the newman runner, run logger, and
cancellation/re-run flows.

End-to-end: a user presses enter on the variables form; the run
view opens, shows the progress bar filling up as requests complete,
auto-follows the running request, lets the user press `tab` to
reveal the detail pane for any request, and on completion shows
pass/fail with `r` to re-run.

## Acceptance criteria

- [ ] `DetailPane` component in `src/ui/components/` — scrollable,
      shows: request (method, URL, headers, body), response
      (status, duration, headers, body — JSON pretty-printed),
      console output, variables set by scripts, failure summary
      on failure
- [ ] Request list rows: glyph · method · status code · duration ·
      request name · `💬` when console output present
- [ ] Glyphs: `✓` pass (default colour), `✗` fail (red), `⋯`
      pending (dim), `▶` running (orange spinner), `—`
      skipped/cancelled (dim)
- [ ] Top progress bar: `N/M requests`, orange fill, updates live
- [ ] Selection auto-follows the running request until the user
      presses `↑`/`↓`; `f` re-attaches to the running request
- [ ] `tab` toggles the detail pane; pane hidden by default during
      a run; `d` jumps focus to the detail pane on the
      selected/failed request
- [ ] Detail pane hidden by default during a run; auto-shown on
      run completion if the run failed
- [ ] `esc` mid-run: calls `run.abort()`, marks remaining requests
      as cancelled, stays on run view showing partial results;
      second `esc` returns to flow picker
- [ ] `r` post-run: reloads workspace from disk, re-runs the same
      flow with the same variables (does not revisit the form)
- [ ] `c` key mid-run and post-run: toggles `continue-on-error`
      (takes effect on the next run for mid-run toggle)
- [ ] Run logger called on every `RunEvent`; `close()` called on
      run completion
- [ ] Only one run at a time; `r` is inactive while a run is
      in progress
- [ ] Footer hints during run:
      `↑↓ nav · tab detail · f follow · c continue · esc cancel`
- [ ] Footer hints post-run:
      `↑↓ nav · tab detail · r re-run · esc back`

## Blocked by

- [0011 variables form screen](./0011-variables-form-screen.md)
- [0004 newman runner](./0004-newman-runner.md)
- [0005 run logger](./0005-run-logger.md)
