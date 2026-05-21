# can-you-please — agent notes

## .me/

`.me/` is gitignored. It holds local development aids that shouldn't
live in the repo.

### .me/dep-clones/

Clones of dependencies kept here as source-level documentation.

| Directory | Purpose |
|-----------|---------|
| `ink/` | [ink](https://github.com/vadimdemedes/ink) — React for CLIs; reference when working on the TUI |

## versioning

- **v1** — first iteration of the app, lives on `main`
- **v2** — the current rewrite, lives on the `v2` branch
- **r1** (release 1) — the first release of v2

## style

All user-facing text (TUI labels, prompts, README copy, etc.) must be
lowercase. This applies to prose and UI strings — not code identifiers.
