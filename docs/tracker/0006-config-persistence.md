# config persistence

**labels:** needs-triage

## What to build

Implement the config module: read and write the app's persisted
settings to a JSON file at `~/.config/can-you-please/config.json`.
For r1 the only field is `workspacePath`. The module must be
forward-compatible — unknown keys from future versions are
preserved on write.

End-to-end: on first launch the config file does not exist and
`readConfig()` returns `null`. After the setup wizard completes,
`writeConfig({ workspacePath })` persists the path. Next launch
`readConfig()` returns the saved path.

## Acceptance criteria

- [ ] `readConfig(): Promise<AppConfig | null>` in
      `src/workspace/config.ts` (or `src/config.ts`) — returns
      `null` when the file is absent
- [ ] `writeConfig(patch: Partial<AppConfig>): Promise<void>` —
      merges patch into existing config (preserves unknown keys)
- [ ] `AppConfig` type: `{ workspacePath: string }` for r1
- [ ] Config directory created automatically if absent
- [ ] File written atomically (write to temp, rename) to avoid
      corruption on crash
- [ ] Unit tests cover: missing file returns null, round-trip
      write/read, unknown keys preserved, concurrent write safety
      (best-effort)

## Blocked by

- [0001 project scaffolding](./0001-project-scaffolding.md)
