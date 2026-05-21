# npm distribution

**labels:** needs-triage

## What to build

Finalise everything needed to publish `can-you-please` to npm as a
runnable package. This is the last slice — it verifies the app
works end-to-end from a cold `npx can-you-please` invocation.

End-to-end: a developer runs `npm publish --dry-run`, sees the
correct files included, then does the real publish. Another
developer runs `npx can-you-please` and the TUI launches.

## Acceptance criteria

- [ ] `package.json` publish fields complete: `name`, `version`,
      `description`, `keywords`, `author`, `license: "MIT"`,
      `repository`, `homepage`, `bugs`
- [ ] `.npmignore` (or `files` field) excludes: `src/`, `test/`,
      `docs/`, `.me/`, `*.md` (except root `README.md`),
      `tsconfig.json`, `.eslintrc*`
- [ ] `README.md` covers: what it is, install (`npm install -g`
      or `npx`), prerequisites (Node ≥ 22, a Collection 3 repo),
      quick-start (run `can-you-please`, follow the setup wizard)
- [ ] `LICENSE` file present (MIT)
- [ ] `npm run build && npm publish --dry-run` completes without
      errors; packed files list looks correct
- [ ] `npx can-you-please` from a temp directory launches the TUI
      (manual smoke test documented in this issue)
- [ ] Node version hard-fail message tested: running with Node 20
      prints a clear error and exits 1

## Blocked by

- [0012 run view screen](./0012-run-view-screen.md)
- [0013 help overlay](./0013-help-overlay.md)
