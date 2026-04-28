# Test Coverage Design: Reaching 100%

## Goal

Bring test coverage from 62.41% to 100% (statements, functions, lines) and 95%+ branches, by adding missing unit tests for all business-logic modules. `src/cli.ts` and `src/types.d.ts` are excluded from coverage as they contain only framework wiring.

## Coverage Config Changes

```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'html'],
  include: ['src/**/*.ts'],
  exclude: ['src/cli.ts', 'src/types.d.ts'],
}
```

## Files to Add or Supplement

### New test files

| File | What to cover |
|------|--------------|
| `tests/services/settings-env-service.test.ts` | read (file missing, file present, non-ENOENT error), write (creates file, preserves siblings, non-ENOENT error) |
| `tests/services/project-state-service.test.ts` | getLastPreset (missing, present), saveLastPreset (creates, updates) |
| `tests/services/project-env-service.test.ts` | read/write JSON, read/write YAML, conflict error, envelope with meta, missing dir |
| `tests/core/logger.test.ts` | createLogger creates log file at correct path |
| `tests/commands/preset/show.test.ts` | no presets, global only, project only, mixed; project env with name; project env without name |

### Supplement existing test files

| File | Missing scenarios |
|------|------------------|
| `tests/core/find-claude.test.ts` | alias path, bash wrapper with exec, fallback to ~/.claude/local/claude, fallback to node_modules/.bin, throws when not found |
| `tests/core/spawn.test.ts` | signal termination, null exitCode, non-zero exitCode |
| `tests/core/format.test.ts` | formatRunEnvBlock (with/without other vars), formatRestorePreview |
| `tests/core/errors.test.ts` | invalidUsage returns CliError with exitCode 2 |
| `tests/core/paths.test.ts` | resolveLogPath, resolveHistoryPath, resolvePresetPath |
| `tests/commands/doctor.test.ts` | uncovered branches (lines 37-38, 85) |
| `tests/commands/restore.test.ts` | uncovered error paths (lines 78-79, 112-127) |
| `tests/flows/init-flow.test.ts` | toggle required key (no-op), toggle non-required key off, invalid action on confirm step |
| `tests/flows/restore-flow.test.ts` | wrong action type on each step, preset target without name, confirm with missing targetType |

## Test Conventions

- Use `mkdtemp` + `afterEach` cleanup for all file-system tests
- Mock `execSync` / `cross-spawn` via `vi.mock` for `find-claude` and `spawn` tests
- Use `expect().resolves` / `.rejects` for async assertions
- Test names describe observable behavior, not implementation details
- No mocking of internal modules — test through public interfaces

## Implementation Order

1. Core layer: `logger`, `errors`, `paths`, `format`, `spawn`, `find-claude`
2. Services layer: `settings-env-service`, `project-state-service`, `project-env-service`
3. Commands layer: `preset/show`, `doctor` supplement, `restore` supplement
4. Flows layer: `init-flow` supplement, `restore-flow` supplement
