# run logger

**labels:** needs-triage

## What to build

Implement the `logger/` module: open a log file at run start and
write a structured plain-text record of every request event as it
arrives. The log is the post-mortem debugging surface; the run view
is the live one.

End-to-end: after a run completes, a file appears under
`~/.config/can-you-please/logs/` with a sortable timestamp name,
pass/fail suffix, and a human-readable record of every request
including full request/response detail and any console output.

## Acceptance criteria

- [ ] `createRunLogger(flow: Flow, logDir: string): RunLogger`
      in `src/logger/`
- [ ] `RunLogger` interface: `write(event: RunEvent): void`,
      `close(outcome: "pass" | "fail"): Promise<void>`
- [ ] Log filename format:
      `YYYY-MM-DD_HH-mm-ss_<group>__<flow>_<outcome>.log`
      (`:` replaced with `-`; group and flow joined with `__`;
      ungrouped flows omit group prefix)
- [ ] Each request delimited by:
      `=== request N/M: <name> (<METHOD> <status>, <ms>ms) ===`
- [ ] Each request section includes: timestamp, fully-resolved
      URL, final headers, body, response status + headers + body,
      console output, variables set by scripts
- [ ] On failure: parsed `error` / `message` / `details` appended
      to the section
- [ ] Response bodies truncated at 1 MB with
      `[truncated, original size: N bytes]` marker
- [ ] Log directory created if it does not exist
- [ ] Unit tests cover: filename generation (grouped, ungrouped,
      pass, fail), body truncation boundary, multi-request
      ordering

## Blocked by

- [0004 newman runner](./0004-newman-runner.md)
