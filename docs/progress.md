# progress

## completed

### 0001 — project scaffolding
_commit c9f1852_

- created `package.json` (`name: can-you-please`, `engines: >=22`,
  `type: module`, `bin → dist/bin.js`)
- `src/bin.ts` guards against node <22 and prints stub message
- `tsconfig.json` targeting ESNext/NodeNext strict mode, outputs to
  `dist/`
- eslint (flat config) + prettier wired up; `npm run lint` passes
- `src/` and `test/` directory skeletons match PRD shape
  (`workspace/`, `variables/`, `runner/`, `logger/`,
  `ui/screens/`, `ui/components/`, `ui/hooks/`, `domain.ts`)
- `test/fixtures/workspace/` directory created (empty)
- placeholder `node:test` suite passes
- `.gitignore` excludes `node_modules/` and `dist/`
- all acceptance criteria in tracker 0001 satisfied

### 0002 — workspace loader
_commit dcf9314_

- defined all domain types in `src/domain.ts`: `Workspace`, `Flow`,
  `BrokenFlow`, `AnyFlow`, `Request`, `RequestBody`, `Script`,
  `Environment`, `Globals`, `EnvValue`
- `loadWorkspace(path)` in `src/workspace/index.ts`: walks
  `postman/collections/`, parses `*.request.yaml` + `.resources/definition.yaml`,
  parses environments and globals
- broken flows (malformed YAML, wrong `$kind`, missing name) included
  as `BrokenFlow` values — not thrown; other flows unaffected
- duplicate fully-qualified names flagged with `duplicateWarning` on
  both flows
- `isValidWorkspace(ws)` guard: true iff ≥1 valid flow and ≥1 env
- flows sorted: ungrouped first, then groups alphabetically; within
  each group by `order` asc then alphabetical by name
- five fixture workspaces: `ungrouped`, `grouped`, `broken-flow`,
  `single-env`, `vars-and-enums`
- 18 unit tests, all passing; lint clean
- `npm test` updated to `tsc && node --test`
- `yaml` package added as dependency

### 0003 — variable detection and merge
_commit e925998_

- `detectVariables(flow)` in `src/variables/index.ts`: scans every
  `{{name}}` token from request URLs, header values, and body content;
  returns `VariableMeta[]` (name, required, enums, defaultValue)
- `mergeVariables(layers)`: pure left-to-right merge; later layers win;
  JSDoc notes that `pm.variables.set()` is runtime-only, not merged here
- `resolveVariables(flow, env, globals, formInput)`: full pipeline in
  precedence order (flow defaults < globals < env < form); seeds
  required vars with `""` when absent from all layers
- disabled env/globals values (`enabled: false`) excluded from merge
- 25 new tests covering token scanning, metadata annotation, precedence,
  required-but-missing, `~`/`$` characters; all 43 tests pass; lint clean

## next up

0004 — newman runner
