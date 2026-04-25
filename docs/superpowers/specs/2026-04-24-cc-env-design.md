# cc-env Design Spec

Date: 2026-04-24
Status: Approved for implementation
Scope: Full v1

## 1. Objective

Build a Node.js CLI named `cc-env` that injects a deterministic set of environment variables into a child process at runtime, primarily for Claude Code CLI usage, without relying on persistent shell mutation.

The tool must support:
- global presets for provider switching
- project-level env overrides
- migration from `~/.claude/settings.json`
- history and restore flows
- masked output for sensitive values
- deterministic merge behavior

## 2. Product Decisions Confirmed

The following decisions were confirmed during design:

- Full v1 scope is in scope, not MVP-only.
- Destructive or state-changing confirmation flows default to interactive confirmation, with `--yes` available for non-interactive automation.
- `debug` supports explicit `--preset <name>` and also falls back to a default preset in `~/.cc-env/config.json`.
- `preset create` interactive variable enumeration defaults to `process.env` and `~/.claude/settings.json.env`, and may additionally import current project env when present.
- `init` migrates selected keys from `~/.claude/settings.json.env` into a global preset chosen interactively by the user, and also writes a history record.
- Migrated variables belong to the global configuration domain, not the project override layer.
- `restore` supports choosing the destination interactively: restore to `settings.json.env` or to a global preset.
- Preset secrets are allowed to be stored in plaintext on disk in v1; outputs and logs must still mask sensitive values.
- Project env is part of full v1. It is managed indirectly through `preset create` flows: users can import current project env into a create flow and can choose to save create results back to the current project env file.
- Action commands use subcommands rather than long flags. Behavior modifiers still use flags.
- If both `./.cc-env/env.json` and `./.cc-env/env.yaml` exist, the command fails with a human-readable error.
- The design approach is a layered command-oriented architecture rather than a monolithic CLI or heavyweight domain abstraction.

## 3. Command Model

Action-style operations are represented as subcommands:

```bash
cc-env run [--preset <name>] [--dry-run] <command> [args...]
cc-env init [--yes]
cc-env restore [--yes]
cc-env preset create [--file <path>] [KEY=VALUE ...]
cc-env preset list
cc-env preset show <name>
cc-env preset delete <name> [--yes]
cc-env preset edit <name>
cc-env debug [--preset <name>]
```

### 3.1 Command semantics

#### `cc-env run`
- Loads env inputs from all supported sources.
- Resolves the effective preset from `--preset` or the default preset in `~/.cc-env/config.json`.
- If neither is available, fails with a human-readable preset selection error.
- Merges environment variables in the deterministic order defined below.
- Spawns the target child process with `stdio: 'inherit'`.
- Uses `cross-spawn`, not `exec()`.
- In `--dry-run`, prints what would run and the masked env values that would be injected, but does not spawn and does not mutate state.

#### `cc-env init`
- Reads `~/.claude/settings.json`.
- If no `env` field exists, prints `No env field found` and exits successfully without writing state.
- Uses Ink UI to let the user select which keys to migrate.
- Uses Ink UI to let the user name or select the destination global preset.
- Shows a preview of which keys will be written to the preset and removed from `settings.json.env`.
- Confirms before applying unless `--yes` is provided.
- On apply:
  - writes selected keys to the destination global preset
  - writes a history record
  - removes the selected keys from `~/.claude/settings.json.env`

#### `cc-env restore`
- Lists available history records in Ink.
- Lets the user select a history record.
- Lets the user choose the restore target:
  - `~/.claude/settings.json.env`
  - a global preset
- Detects key collisions and asks for overwrite confirmation unless `--yes` is provided.
- Applies the restore and records the result in logs.

#### `cc-env preset create`
Supports three input modes:
- interactive selection
- file import with `--file`
- inline `KEY=VALUE` arguments

Interactive mode:
- lets the user choose variables from:
  - `process.env`
  - `~/.claude/settings.json.env`
- may additionally import current project env when present
- then lets the user choose the save target:
  - a global preset
  - the current project env file

Project env save behavior:
- if a project env file already exists, preserve its existing format
- if neither project env file exists, default to writing `./.cc-env/env.json`

#### `cc-env preset list`
- Prints a compact tabular list of presets with name, updated date, and variable count.
- No Ink UI.

#### `cc-env preset show <name>`
- Prints the preset content with sensitive values masked.
- No Ink UI.

#### `cc-env preset delete <name>`
- Requires confirmation unless `--yes` is provided.
- Deletes the preset file under file lock.

#### `cc-env preset edit <name>`
- Opens the preset in `$EDITOR`.
- Validation is re-run after save.
- Invalid edited content is rejected with a human-readable error.

#### `cc-env debug`
- Resolves preset from `--preset` or default config.
- Loads all env sources.
- Computes the final merged env.
- Prints masked effective env and source participation details.
- No Ink UI.

## 4. Storage Layout

Global state lives under:

```text
~/.cc-env/
  config.json
  presets/
    <name>.json
  history/
    <timestamp>.json
  logs/
    cc-env.log
```

Project state lives under the working directory:

```text
./.cc-env/
  env.json
  env.yaml
```

Exactly zero or one project env file may exist. If both exist, the command fails.

## 5. Data Model

## 5.1 Preset schema

Each preset file is JSON and validates with zod:

```json
{
  "name": "openai",
  "createdAt": "2026-04-24T10:00:00Z",
  "updatedAt": "2026-04-24T10:00:00Z",
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.openai.com",
    "ANTHROPIC_AUTH_TOKEN": "sk-xxx"
  }
}
```

Rules:
- `env` must be a flat object
- all values must be strings
- all keys must match `^[A-Z0-9_]+$`

## 5.2 History schema

Each history record is JSON and validates with zod:

```json
{
  "timestamp": "2026-04-24T10:00:00Z",
  "action": "init",
  "movedKeys": ["ANTHROPIC_BASE_URL"],
  "backup": {
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com"
  },
  "targetType": "preset",
  "targetName": "openai"
}
```

Required semantics:
- `timestamp` identifies when the state-changing operation happened
- `action` identifies the originating action, such as `init` or `restore`
- `movedKeys` records which keys were affected
- `backup` stores the source values needed for restore
- `targetType` is either `settings` or `preset`
- `targetName` is present when `targetType` is `preset`

## 5.3 Config schema

`~/.cc-env/config.json` stores stable global tool settings. For v1, it only needs:

```json
{
  "defaultPreset": "openai"
}
```

## 6. Deterministic Merge Rules

The effective env must always be computed in the same precedence order:

1. `~/.claude/settings.json.env`
2. `process.env`
3. selected preset
4. project env

Later sources override earlier sources.

This order is implemented once in a dedicated runtime env service and reused by both `run` and `debug`.

## 7. Architecture

The implementation uses a layered structure:

- **CLI layer** — Commander setup and top-level process exit handling
- **Command layer** — one entry per command or subcommand
- **Service layer** — business logic for presets, history, settings migration, project env, and runtime merge
- **Core layer** — schemas, masking, paths, locking, errors, logger, and process spawning helpers

Suggested source layout:

```text
src/
  cli.ts
  commands/
    run.ts
    init.ts
    restore.ts
    debug.ts
    preset/
      create.ts
      list.ts
      show.ts
      delete.ts
      edit.ts
  services/
    preset-service.ts
    project-env-service.ts
    settings-env-service.ts
    history-service.ts
    runtime-env-service.ts
  core/
    schema.ts
    mask.ts
    paths.ts
    lock.ts
    errors.ts
    logger.ts
    spawn.ts
```

### 7.1 Architectural rule

All computation of the final merged env must happen in `runtime-env-service`. No command may reimplement merge precedence independently.

## 8. Interaction Design

Ink is used only for complex interactive flows:
- `init`
- `restore`
- interactive `preset create`

Ink is not used for:
- `preset list`
- `preset show`
- `debug`

### 8.1 `init` interaction flow
1. Load `settings.json.env`
2. Show selectable keys and masked previews
3. Ask for destination global preset name
4. Show operation preview
5. Confirm or auto-apply with `--yes`
6. Apply write operations under lock

### 8.2 `restore` interaction flow
1. List history records
2. Select one record
3. Select restore target
4. Detect collisions
5. Ask overwrite confirmation or auto-overwrite with `--yes`
6. Apply write operations under lock

### 8.3 `preset create` interaction flow
1. Determine input mode
2. For interactive mode, select variable source(s)
3. Select keys and values
4. Select destination target
5. Preview result
6. Apply write operations under lock

## 9. Security and Privacy Rules

Sensitive values may be stored in preset files in plaintext in v1, but must never be emitted raw in user-facing output or logs when the key name indicates a secret.

Masking applies to keys matching at least:
- `*_TOKEN`
- `*_KEY`
- `*_SECRET`
- `*_PASSWORD`

Masked output should preserve enough prefix to identify the value, for example:

```text
sk-123456********
```

The logger must never write full secret values.

## 10. Concurrency and File Safety

Every state-changing write uses file locking via `proper-lockfile`.

This includes:
- writing presets
- deleting presets
- editing presets after validation
- mutating `~/.claude/settings.json`
- writing history records
- writing project env files
- updating `config.json`

The system must prefer reversible writes:
- read current state
- validate intended new state
- write atomically where possible
- record history for destructive migrations and restore operations

## 11. Error Handling

All user-facing errors are short and human-readable.

Rules:
- no stack traces in normal CLI output
- non-zero exit codes for failure
- distinguish argument errors from business-logic failures

Suggested exit code policy:
- `1` — runtime or business error
- `2` — invalid CLI usage or argument validation

Examples:
- `Preset not found: openai`
- `Project env conflict: env.json and env.yaml both exist`
- `No env field found`

## 12. Logging

Log file path:

```text
~/.cc-env/logs/cc-env.log
```

Log entries include:
- timestamp
- command
- result
- error summary when present

Logs must not include raw secret values.

## 13. Testing Strategy

### 13.1 Unit tests
Cover:
- zod schema validation
- env merge precedence
- secret masking
- default preset fallback
- project env conflict detection
- project env format preservation

### 13.2 Integration tests
Cover:
- `run --dry-run`
- `preset create --file`
- inline `preset create`
- `init` migration side effects
- `restore` side effects
- `debug` output shape

### 13.3 Interaction tests
For Ink flows, test:
- key selection
- target selection
- overwrite confirmation
- `--yes` bypass behavior

Tests should verify decisions and side effects, not terminal styling.

## 14. Implementation Boundaries

This v1 does not include:
- shell mutation
- token lifecycle management
- secret encryption or OS keychain integration
- sandboxing
- Claude CLI hooking
- project env dedicated management commands outside the `preset create` flow

## 15. Recommended Implementation Sequence

1. Initialize TypeScript project structure and build/test tooling
2. Implement core schema, path, mask, error, and lock utilities
3. Implement preset storage service and config service
4. Implement project env and settings env readers/writers
5. Implement runtime env merge service
6. Implement `preset list/show/create/delete/edit`
7. Implement `debug`
8. Implement `run` with `--dry-run`
9. Implement `init`
10. Implement `restore`
11. Add interaction tests and integration coverage

## 16. Success Criteria

The design is successful when:
- the same inputs always produce the same merged env
- the tool can switch provider settings without shell mutation
- global presets and project env can be combined predictably
- migration from `~/.claude/settings.json.env` is reversible
- restore can target either settings or preset destination
- all secret-like output is masked
- all state-changing writes are lock-protected
- non-interactive automation is possible via `--yes` and `--dry-run`
