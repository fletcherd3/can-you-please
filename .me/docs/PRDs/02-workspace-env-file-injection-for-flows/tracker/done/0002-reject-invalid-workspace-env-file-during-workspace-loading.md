---
id: "0002"
title: "reject invalid workspace env file during workspace loading"
type: "AFK"

---

## What to build

Validate the workspace env file as part of workspace loading and fail fast with a clear error when the file is malformed. Missing `.env` files remain valid, but malformed ones should stop the workspace from loading so startup, workspace selection, and reload all behave consistently.

## Acceptance criteria

- [x] a malformed `{workspace}/.env` causes workspace loading to fail with a clear error message that identifies the parse problem
- [x] valid blank entries like `KEY=` are accepted and treated as blank values
- [x] startup, setup wizard path confirmation, and workspace reload surface the `.env` load failure instead of silently ignoring it

## Blocked by

- `.me/docs/tracker/0001-load-workspace-env-file-into-globals-for-flow-runs.md`
