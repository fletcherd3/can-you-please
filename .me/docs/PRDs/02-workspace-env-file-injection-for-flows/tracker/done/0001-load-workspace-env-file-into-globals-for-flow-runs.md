---
id: "0001"
title: "load workspace env file into globals for flow runs"
type: "AFK"

---

## What to build

Add support for reading `{workspace}/.env` and injecting its key/value pairs into the workspace globals layer in memory for flow runs. This slice should make local-only values available to requests and scripts through the same variable resolution path as other globals, including workspaces that do not have a checked-in globals file.

## Acceptance criteria

- [x] when `{workspace}/.env` exists, its keys are available during a flow run through the globals layer without writing anything back to disk
- [x] when both a checked-in globals file and `.env` define the same key, the `.env` value wins inside the globals layer
- [x] when no globals file exists but `.env` does, flows can still use `.env` keys directly or through existing postman variable references

## Blocked by

None - can start immediately
