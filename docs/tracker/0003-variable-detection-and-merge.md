# variable detection & merge

**labels:** needs-triage

## What to build

Implement the `variables/` module: scan every `{{name}}` token
across a flow's request URLs, headers, and bodies; then resolve a
final variable map by merging all five precedence layers.

End-to-end: given a loaded `Flow`, `Environment`, `Globals`, and
form input, `resolveVariables(...)` returns a `Record<string,
string>` ready for the Newman runner to inject, and
`detectVariables(flow)` returns the full set of variable names
with their metadata (required flag, enum options, default value).

## Acceptance criteria

- [ ] `detectVariables(flow: Flow): VariableMeta[]` in
      `src/variables/` — scans url, header values, and body
      content of every request for `{{name}}` tokens
- [ ] `VariableMeta` includes: `name`, `required: boolean`,
      `enums: string[]`, `defaultValue: string | undefined`
- [ ] Required flag sourced from `definition.yaml` `requires`
      list; enum options from `enums` map; default from
      `variables` map
- [ ] `mergeVariables(layers: VariableLayer[]): Record<string, string>`
      applies precedence: flow defaults < globals < environment <
      form input (later layers win)
- [ ] `pm.variables.set()` values are NOT part of the static merge
      (they're applied at runtime by Newman); the function comment
      documents this
- [ ] Variables declared in `requires` but absent from all layers
      are included in the result with value `""` so the form can
      flag them as blank
- [ ] Unit tests cover: token scanning across url/headers/body,
      precedence ordering (each layer wins over lower ones),
      required-but-missing case, enum extraction, `~` and `$`
      characters in values do not confuse the scanner

## Blocked by

- [0002 workspace loader](./0002-workspace-loader.md)
