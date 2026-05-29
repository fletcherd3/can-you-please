---
id: "0004"
title: "cover workspace env file resolution with tests"
type: "AFK"

---

## What to build

Add automated coverage for workspace env file parsing, workspace loading, variable resolution, and variables form provenance behaviour so the new `.env` support remains trustworthy as the app evolves.

## Acceptance criteria

- [x] automated tests cover valid and invalid `.env` parsing, including comments, blank values, duplicate keys, and malformed lines
- [x] automated tests cover workspace loading and variable resolution precedence across checked-in globals, `.env`, environment values, and form input
- [x] automated tests cover the variables form `(from .env)` behaviour, including hint appearance, disappearance on edit, and reappearance when the value matches again

## Blocked by

- `.me/docs/tracker/0001-load-workspace-env-file-into-globals-for-flow-runs.md`
- `.me/docs/tracker/0002-reject-invalid-workspace-env-file-during-workspace-loading.md`
- `.me/docs/tracker/0003-show-workspace-env-file-provenance-in-the-variables-form.md`
