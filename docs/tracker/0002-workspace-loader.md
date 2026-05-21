# workspace loader

**labels:** needs-triage

## What to build

Implement the `workspace/` module: walk a Collection 3 directory
tree, parse every YAML file, validate the result, and return a
typed `Workspace` value (or a structured list of errors). This is
the single source of truth for domain types used by every other
module.

End-to-end: given a path on disk, `loadWorkspace(path)` returns
a `Workspace` containing typed `Flow[]`, `Environment[]`, and
`Globals | null`. Broken flows are included in the result as
`BrokenFlow` values (not thrown), so the picker can render them
with a warning glyph.

## Acceptance criteria

- [ ] Domain types defined in `src/domain.ts`: `Workspace`,
      `Flow`, `BrokenFlow`, `Request`, `Environment`, `Globals`,
      `FlowDefinition`, `RequestBody`, `Script`
- [ ] `loadWorkspace(path: string): Promise<Workspace>` in
      `src/workspace/`
- [ ] Parses `*.request.yaml` (method, url, headers, body, scripts,
      order); validates `$kind` when present
- [ ] Parses `definition.yaml` (name, description, order,
      environments, continueOnError, variables, requires, enums);
      `$kind` validated when present
- [ ] Flow `name` field parsed as `group/flow` or bare `flow`;
      group extracted correctly
- [ ] Flows ordered: by `order` asc then alphabetical within group;
      groups alphabetical (ungrouped flows first, no header)
- [ ] Broken flows (malformed YAML, wrong `$kind`, missing name)
      included as `BrokenFlow` with a human-readable reason; other
      flows unaffected
- [ ] Duplicate `name` values flagged on both flows with a warning
      (not broken, still selectable)
- [ ] Environments parsed from `postman/environments/*.environment.yaml`;
      matched by file basename not inner `name` field
- [ ] Globals loaded from `postman/globals/`; `workspace.globals.yaml`
      preferred when present
- [ ] `isValidWorkspace(ws: Workspace): boolean` — true iff ≥1 valid
      flow and ≥1 environment exist
- [ ] Fixture workspaces in `test/fixtures/workspace/`: `ungrouped`,
      `grouped`, `broken-flow`, `single-env`, `vars-and-enums`
- [ ] Unit tests cover: happy path, broken flow, duplicate names,
      missing environments dir, empty collections dir

## Blocked by

- [0001 project scaffolding](./0001-project-scaffolding.md)
