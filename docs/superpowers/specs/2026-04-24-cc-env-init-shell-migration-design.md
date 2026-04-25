# cc-env init shell migration redesign

## Goal

Redefine `cc-env init` so it migrates selected env keys out of Claude Code's home-directory settings files and into shell-level global environment configuration. The command must stop creating presets. Its purpose is to remove startup-time env overrides from `~/.claude/settings.json` and `~/.claude/settings.local.json`, then make those values available to new terminal sessions through managed shell config blocks.

## Scope

This redesign changes:

- `init` input sources and migration target
- history shape for init migrations
- `restore` behavior for init history
- supporting services for Claude settings files and shell config files

This redesign does not change:

- preset CRUD behavior
- project env file behavior
- runtime merge precedence beyond the already-approved `process < settings < project < preset`

## Required init behavior

### Input sources

`init` reads only these two files in the user's home Claude directory:

- `~/.claude/settings.json`
- `~/.claude/settings.local.json`

For each file, `init` reads only its `env` field. If both files are missing, `init` exits with an error.

If the same env key exists in both files, `settings.local.json` wins for the effective migration value.

### Selection behavior

`init` builds a candidate view from the union of both `env` maps.

These six keys are always selected by default and cannot be deselected:

- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_DEFAULT_HAIKU_MODEL`
- `ANTHROPIC_DEFAULT_OPUS_MODEL`
- `ANTHROPIC_DEFAULT_SONNET_MODEL`
- `ANTHROPIC_REASONING_MODEL`

The user may add other discovered keys to the migration set.

If no selected key resolves to an effective value after applying `settings.local.json` precedence, `init` exits with an error instead of writing empty shell config.

### Migration behavior

After confirmation, `init` performs three operations:

1. Remove the selected keys from `~/.claude/settings.json` `env`
2. Remove the selected keys from `~/.claude/settings.local.json` `env`
3. Write the effective migrated values to managed shell config blocks for:
   - `~/.zshrc`
   - `~/.bashrc`
   - `~/.config/fish/config.fish`

Shell writes guarantee the values are available to newly opened terminals. Already-running terminals are not updated in place.

`init` no longer creates or updates any preset.

## Managed shell block design

Each supported shell file gets a `cc-env` managed block. `cc-env` may only create, replace, or remove content inside its own block.

### zsh/bash block

```sh
# >>> cc-env >>>
export KEY="value"
# <<< cc-env <<<
```

### fish block

```fish
# >>> cc-env >>>
set -gx KEY "value"
# <<< cc-env <<<
```

Behavior rules:

- If the target shell file does not exist, create it and write the managed block
- If the managed block exists, replace the entire block
- If the managed block does not exist, append a new block
- Do not inspect or modify unrelated user content outside the managed block

## Service boundaries

### Claude settings env service

Introduce a dedicated service for Claude home settings files. It is responsible for:

- reading `env` from `~/.claude/settings.json`
- reading `env` from `~/.claude/settings.local.json`
- writing updated `env` maps back to each file independently
- treating missing files as missing sources rather than project-local defaults

This service should expose per-file data so history and restore can preserve source boundaries.

### Shell env service

Introduce a dedicated service for shell config files. It is responsible for:

- rendering shell-specific export syntax
- inserting/replacing/removing the `cc-env` managed block
- reading current managed keys when needed for restore
- handling zsh, bash, and fish paths independently

This service should not parse or rewrite arbitrary user shell config beyond its own block.

## History redesign

The current init history model is too narrow because it stores a single backup map and assumes restore targets are either `settings` or `preset`.

Init history must be expanded so restore can reverse the migration without guessing. An init record must contain at least:

- `timestamp`
- `action: 'init'`
- `migratedKeys`
- `settingsBackup` — keys removed from `~/.claude/settings.json`
- `settingsLocalBackup` — keys removed from `~/.claude/settings.local.json`
- `shellWrites` — which shell files were written and which effective key/value pairs were placed there

Restore logic must rely on this persisted data rather than recomputing source ownership later.

## Restore behavior for init history

For an init-created history entry, `restore` performs a two-way reversal:

1. Remove the migrated keys from the `cc-env` managed blocks in zsh, bash, and fish
2. Restore the backed-up keys to their original Claude settings source files:
   - `settingsBackup` back to `~/.claude/settings.json`
   - `settingsLocalBackup` back to `~/.claude/settings.local.json`

If a shell file was not present when the init record was created, restore should only touch files listed in that record's `shellWrites`.

Restore for non-init history should continue using its existing target-driven flow unless deliberately refactored as part of the implementation.

## Error handling

`init` should fail with a `CliError` when:

- both Claude settings files are missing
- no selected key has an effective value to migrate
- a required settings file cannot be parsed
- a shell config file cannot be updated

`restore` should fail with a `CliError` when:

- the requested history entry does not exist
- a recorded shell target cannot be updated
- a recorded settings target cannot be restored

## Testing

Add or update tests for:

- reading env from both Claude settings files
- `settings.local.json` overriding `settings.json` for effective migrated values
- the six required keys being preselected and non-removable in init flow state
- writing zsh/bash/fish managed blocks
- replacing an existing managed block without touching surrounding content
- removing managed keys during restore
- recording per-file Claude settings backups in history
- restoring those backups to the correct source file
- erroring when both settings files are absent
- erroring when no selected key resolves to a value

## Implementation notes

- Keep the existing codebase pattern of small services plus thin command handlers
- Prefer extending existing restore flow carefully over broad refactors
- Do not add preset compatibility shims to init
- Do not treat current working directory settings files as init inputs anymore
