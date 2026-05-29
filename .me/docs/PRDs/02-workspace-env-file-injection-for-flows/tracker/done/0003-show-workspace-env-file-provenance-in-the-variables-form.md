---
id: "0003"
title: "show workspace env file provenance in the variables form"
type: "AFK"

---

## What to build

Update the variables form so it shows when a variable's current displayed value is coming from the workspace env file. The field should stay editable, and the `(from .env)` hint should appear only while the current value exactly matches the effective non-blank `.env` value for that variable.

## Acceptance criteria

- [x] a variable whose current displayed value comes from `.env` is shown with the actual value followed by `(from .env)`
- [x] editing the field so it no longer matches the effective `.env` value removes the `(from .env)` hint immediately
- [x] editing the field back to the same effective `.env` value makes the `(from .env)` hint reappear, while variables overridden by environment or form input do not show the hint

## Blocked by

- `.me/docs/tracker/0001-load-workspace-env-file-into-globals-for-flow-runs.md`
