# project scaffolding

**labels:** needs-triage

## What to build

Bootstrap the repo so every subsequent slice has a working build,
test, and lint foundation to land on. This is the only slice with
no meaningful runtime behaviour — its deliverable is a green CI
smoke test and a `can-you-please --help` that exits cleanly.

End-to-end: a developer clones the repo, runs `npm install && npm
test`, and sees all checks pass. Running `node dist/bin.js` prints
a "not yet implemented" message and exits 0.

## Acceptance criteria

- [ ] `package.json` present with `name: "can-you-please"`,
      `engines: { node: ">=22" }`, `type: "module"`, and a single
      `bin` entry pointing at `dist/bin.js`
- [ ] Hard Node version check in `src/bin.ts` — prints a clear
      message and exits 1 on Node < 22
- [ ] `tsconfig.json` targets ESNext modules, strict mode on,
      outputs to `dist/`
- [ ] `npm run build` compiles cleanly with zero type errors
- [ ] `npm test` runs via `node:test` and passes (at least one
      placeholder test)
- [ ] ESLint + Prettier configured; `npm run lint` passes
- [ ] `src/` and `test/` directory skeletons match the shape in
      the PRD (`workspace/`, `variables/`, `runner/`, `logger/`,
      `ui/screens/`, `ui/components/`, `ui/hooks/`, `domain.ts`)
- [ ] `test/fixtures/workspace/` directory exists (empty, ready
      for fixture data)

## Blocked by

None — can start immediately.
