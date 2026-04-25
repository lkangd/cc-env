# cc-env Init Shell Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `cc-env init` and `restore` so selected env keys move between `~/.claude/settings*.json` and managed shell config blocks instead of presets.

**Architecture:** Keep the current service-oriented shape: add one service for Claude home settings and one service for managed shell blocks, then rewrite `init`/`restore` to orchestrate those services. Preserve runtime env merge behavior, but expand history to record per-file backups and shell writes so restore can reverse an init migration without guessing.

**Tech Stack:** Node.js, TypeScript, Commander, Ink, zod, proper-lockfile, Vitest

---

## File Structure

### Files to modify
- Modify: `src/core/schema.ts` — expand history types for init shell migration records
- Modify: `src/core/paths.ts` — add Claude home and shell config path helpers
- Modify: `src/commands/init.ts` — replace preset migration with Claude-home-to-shell migration
- Modify: `src/commands/restore.ts` — restore init records by removing shell keys and restoring both Claude settings files
- Modify: `src/flows/init-flow.ts` — remove preset target step, add required-key handling
- Modify: `src/flows/restore-flow.ts` — branch flow by history record action
- Modify: `src/ink/init-app.tsx` — show required keys and confirm shell migration
- Modify: `src/ink/restore-app.tsx` — show init restore confirmation path without preset/settings target selection
- Modify: `src/cli.ts` — wire new services and updated flow contracts
- Modify: `tests/core/schema-mask.test.ts` — cover new init history shape
- Modify: `tests/services/storage.test.ts` — persist expanded init history records
- Modify: `tests/flows/init-flow.test.ts` — cover required-key selection rules
- Modify: `tests/flows/restore-flow.test.ts` — cover init-record-specific restore flow path
- Modify: `tests/integration/init-restore.test.ts` — cover dual Claude settings sources and shell restoration

### Files to create
- Create: `tests/core/paths.test.ts` — verify Claude home and shell config path resolution
- Create: `src/services/claude-settings-env-service.ts` — read/write `~/.claude/settings.json` and `~/.claude/settings.local.json`
- Create: `src/services/shell-env-service.ts` — manage `cc-env` blocks in zsh/bash/fish config files
- Create: `tests/services/claude-shell.test.ts` — verify Claude settings service and shell block service behavior

### Responsibility boundaries
- `src/core/schema.ts` owns the persisted record shape. Do not bury history shape in commands.
- `src/services/claude-settings-env-service.ts` owns only `~/.claude/settings.json` and `~/.claude/settings.local.json`.
- `src/services/shell-env-service.ts` owns only the `# >>> cc-env >>>` managed blocks in shell config files.
- `src/commands/init.ts` computes effective values, backups, and call ordering; it does not parse shell files itself.
- `src/commands/restore.ts` reverses history records; it should not guess original ownership.
- `src/flows/*` stay pure and encode selection/confirmation rules without filesystem access.

---

### Task 1: Expand history and path primitives for shell migration

**Files:**
- Modify: `src/core/schema.ts`
- Modify: `src/core/paths.ts`
- Modify: `tests/core/schema-mask.test.ts`
- Modify: `tests/services/storage.test.ts`
- Create: `tests/core/paths.test.ts`

- [ ] **Step 1: Write the failing tests for the new init history shape and home/shell paths**

```ts
import { describe, expect, it } from 'vitest'

import { historySchema } from '../../src/core/schema.js'

describe('historySchema', () => {
  it('accepts init history with per-file backups and shell writes', () => {
    const result = historySchema.parse({
      timestamp: '2026-04-24T12:00:00.000Z',
      action: 'init',
      migratedKeys: ['ANTHROPIC_AUTH_TOKEN'],
      settingsBackup: {
        ANTHROPIC_BASE_URL: 'https://settings.example.com',
      },
      settingsLocalBackup: {
        ANTHROPIC_AUTH_TOKEN: 'local-token',
      },
      shellWrites: [
        {
          shell: 'zsh',
          filePath: '/Users/test/.zshrc',
          env: {
            ANTHROPIC_AUTH_TOKEN: 'local-token',
          },
        },
      ],
    })

    expect(result.action).toBe('init')
    expect(result.shellWrites[0]?.shell).toBe('zsh')
  })
})
```

```ts
import { describe, expect, it } from 'vitest'

import {
  resolveClaudeSettingsLocalPath,
  resolveClaudeSettingsPath,
  resolveShellConfigPaths,
} from '../../src/core/paths.js'

describe('Claude home path helpers', () => {
  it('resolves both Claude settings files under the given home directory', () => {
    expect(resolveClaudeSettingsPath('/Users/test')).toBe('/Users/test/.claude/settings.json')
    expect(resolveClaudeSettingsLocalPath('/Users/test')).toBe(
      '/Users/test/.claude/settings.local.json',
    )
  })

  it('resolves zsh, bash, and fish config targets', () => {
    expect(resolveShellConfigPaths('/Users/test')).toEqual({
      zsh: '/Users/test/.zshrc',
      bash: '/Users/test/.bashrc',
      fish: '/Users/test/.config/fish/config.fish',
    })
  })
})
```

```ts
it('persists expanded init history records', async () => {
  const service = createHistoryService(root)

  await service.write({
    timestamp: '2026-04-24T10:00:00.000Z',
    action: 'init',
    migratedKeys: ['ANTHROPIC_AUTH_TOKEN'],
    settingsBackup: {},
    settingsLocalBackup: {
      ANTHROPIC_AUTH_TOKEN: 'local-token',
    },
    shellWrites: [
      {
        shell: 'fish',
        filePath: '/Users/test/.config/fish/config.fish',
        env: {
          ANTHROPIC_AUTH_TOKEN: 'local-token',
        },
      },
    ],
  })

  await expect(service.list()).resolves.toMatchObject([
    {
      action: 'init',
      shellWrites: [
        {
          shell: 'fish',
        },
      ],
    },
  ])
})
```

- [ ] **Step 2: Run the targeted tests to verify they fail for the expected reason**

Run: `npm test -- tests/core/schema-mask.test.ts tests/core/paths.test.ts tests/services/storage.test.ts`
Expected: FAIL because `historySchema` still expects `movedKeys` + `backup` + `targetType`, and the new path helpers do not exist yet.

- [ ] **Step 3: Implement the minimal schema and path changes**

```ts
import { z } from 'zod'

const envKeySchema = z.string().regex(/^[A-Z0-9_]+$/)

export const envMapSchema = z.record(
  envKeySchema,
  z.unknown()
    .refine((value) => value === null || typeof value !== 'object')
    .transform((value) => String(value)),
)

const shellWriteSchema = z.object({
  shell: z.enum(['zsh', 'bash', 'fish']),
  filePath: z.string(),
  env: envMapSchema,
})

const initHistorySchema = z.object({
  timestamp: z.string().datetime({ offset: true }),
  action: z.literal('init'),
  migratedKeys: z.array(envKeySchema),
  settingsBackup: envMapSchema,
  settingsLocalBackup: envMapSchema,
  shellWrites: z.array(shellWriteSchema),
})

const restoreHistorySchema = z.object({
  timestamp: z.string().datetime({ offset: true }),
  action: z.literal('restore'),
  backup: envMapSchema,
  targetType: z.enum(['settings', 'preset']),
  targetName: z.string(),
})

export const historySchema = z.discriminatedUnion('action', [
  initHistorySchema,
  restoreHistorySchema,
])

export type InitHistoryRecord = z.infer<typeof initHistorySchema>
```

```ts
import { join } from 'node:path'

export function resolveGlobalRoot(globalRoot?: string): string {
  return globalRoot ?? join(process.env.HOME ?? process.cwd(), '.cc-env')
}

export function resolveClaudeSettingsPath(homeDir = process.env.HOME ?? process.cwd()): string {
  return join(homeDir, '.claude', 'settings.json')
}

export function resolveClaudeSettingsLocalPath(homeDir = process.env.HOME ?? process.cwd()): string {
  return join(homeDir, '.claude', 'settings.local.json')
}

export function resolveShellConfigPaths(homeDir = process.env.HOME ?? process.cwd()) {
  return {
    zsh: join(homeDir, '.zshrc'),
    bash: join(homeDir, '.bashrc'),
    fish: join(homeDir, '.config', 'fish', 'config.fish'),
  }
}
```

- [ ] **Step 4: Re-run the targeted tests to verify the new primitives pass**

Run: `npm test -- tests/core/schema-mask.test.ts tests/core/paths.test.ts tests/services/storage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the primitives update**

```bash
git add src/core/schema.ts src/core/paths.ts tests/core/schema-mask.test.ts tests/core/paths.test.ts tests/services/storage.test.ts
git commit -m "feat: add init shell migration history schema"
```

---

### Task 2: Add Claude home settings and managed shell block services

**Files:**
- Create: `src/services/claude-settings-env-service.ts`
- Create: `src/services/shell-env-service.ts`
- Create: `tests/services/claude-shell.test.ts`

- [ ] **Step 1: Write the failing service tests**

```ts
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'

import { createClaudeSettingsEnvService } from '../../src/services/claude-settings-env-service.js'
import { createShellEnvService } from '../../src/services/shell-env-service.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('Claude settings env service', () => {
  it('reads both settings files and keeps them separate', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'cc-env-home-'))
    roots.push(homeDir)

    await writeFile(
      join(homeDir, '.claude', 'settings.json'),
      '{"env":{"ANTHROPIC_BASE_URL":"https://settings.example.com"}}\n',
      'utf8',
    )
    await writeFile(
      join(homeDir, '.claude', 'settings.local.json'),
      '{"env":{"ANTHROPIC_AUTH_TOKEN":"local-token"}}\n',
      'utf8',
    )

    const service = createClaudeSettingsEnvService({ homeDir })

    await expect(service.read()).resolves.toMatchObject({
      settings: {
        exists: true,
        env: {
          ANTHROPIC_BASE_URL: 'https://settings.example.com',
        },
      },
      settingsLocal: {
        exists: true,
        env: {
          ANTHROPIC_AUTH_TOKEN: 'local-token',
        },
      },
    })
  })
})

describe('shell env service', () => {
  it('writes and updates only the managed block in all shell files', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'cc-env-shell-'))
    roots.push(homeDir)

    await writeFile(join(homeDir, '.zshrc'), 'export PATH="/bin"\n', 'utf8')

    const service = createShellEnvService({ homeDir })

    await service.write({
      ANTHROPIC_AUTH_TOKEN: 'local-token',
    })

    await expect(readFile(join(homeDir, '.zshrc'), 'utf8')).resolves.toContain(
      '# >>> cc-env >>>',
    )
    await expect(readFile(join(homeDir, '.zshrc'), 'utf8')).resolves.toContain(
      'export ANTHROPIC_AUTH_TOKEN="local-token"',
    )
  })

  it('removes only the requested keys from a managed block and leaves user content intact', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'cc-env-shell-'))
    roots.push(homeDir)

    const service = createShellEnvService({ homeDir })
    const shellWrites = await service.write({
      ANTHROPIC_AUTH_TOKEN: 'local-token',
      ANTHROPIC_BASE_URL: 'https://local.example.com',
    })

    await service.removeKeys(shellWrites, ['ANTHROPIC_AUTH_TOKEN'])

    await expect(readFile(join(homeDir, '.bashrc'), 'utf8')).resolves.not.toContain(
      'ANTHROPIC_AUTH_TOKEN',
    )
    await expect(readFile(join(homeDir, '.bashrc'), 'utf8')).resolves.toContain(
      'ANTHROPIC_BASE_URL',
    )
  })
})
```

- [ ] **Step 2: Run the service tests to verify they fail**

Run: `npm test -- tests/services/claude-shell.test.ts`
Expected: FAIL with missing module errors for `claude-settings-env-service.ts` and `shell-env-service.ts`.

- [ ] **Step 3: Implement the two services with the narrowest useful API**

```ts
import { readFile } from 'node:fs/promises'

import { atomicWriteFile } from '../core/fs.js'
import { envMapSchema, type EnvMap } from '../core/schema.js'
import {
  resolveClaudeSettingsLocalPath,
  resolveClaudeSettingsPath,
} from '../core/paths.js'

type ClaudeSettingsSource = {
  path: string
  exists: boolean
  env: EnvMap
}

export function createClaudeSettingsEnvService({ homeDir }: { homeDir?: string } = {}) {
  const settingsPath = resolveClaudeSettingsPath(homeDir)
  const settingsLocalPath = resolveClaudeSettingsLocalPath(homeDir)

  async function readOne(path: string): Promise<ClaudeSettingsSource> {
    try {
      const content = await readFile(path, 'utf8')
      const json = JSON.parse(content) as { env?: unknown }
      return {
        path,
        exists: true,
        env: envMapSchema.parse(json.env ?? {}),
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          path,
          exists: false,
          env: envMapSchema.parse({}),
        }
      }

      throw error
    }
  }

  return {
    read: async () => ({
      settings: await readOne(settingsPath),
      settingsLocal: await readOne(settingsLocalPath),
    }),
    write: async ({
      settingsEnv,
      settingsLocalEnv,
    }: {
      settingsEnv: EnvMap
      settingsLocalEnv: EnvMap
    }) => {
      await atomicWriteFile(
        settingsPath,
        `${JSON.stringify({ env: envMapSchema.parse(settingsEnv) }, null, 2)}\n`,
      )
      await atomicWriteFile(
        settingsLocalPath,
        `${JSON.stringify({ env: envMapSchema.parse(settingsLocalEnv) }, null, 2)}\n`,
      )
    },
  }
}
```

```ts
import { readFile } from 'node:fs/promises'

import { atomicWriteFile } from '../core/fs.js'
import { envMapSchema, type EnvMap } from '../core/schema.js'
import { resolveShellConfigPaths } from '../core/paths.js'

const startMarker = '# >>> cc-env >>>'
const endMarker = '# <<< cc-env <<<'

type ShellName = 'zsh' | 'bash' | 'fish'

type ShellWriteRecord = {
  shell: ShellName
  filePath: string
  env: EnvMap
}

function parseManagedEnv(content: string): EnvMap {
  const match = content.match(/# >>> cc-env >>>[\s\S]*?# <<< cc-env <<</)
  if (!match) {
    return envMapSchema.parse({})
  }

  const lines = match[0]
    .split('\n')
    .slice(1, -1)
    .filter(Boolean)

  return envMapSchema.parse(
    Object.fromEntries(
      lines.map((line) => {
        if (line.startsWith('set -gx ')) {
          const [, key, value] = line.match(/^set -gx ([A-Z0-9_]+) "(.*)"$/) ?? []
          return [key, value]
        }

        const [, key, value] = line.match(/^export ([A-Z0-9_]+)="(.*)"$/) ?? []
        return [key, value]
      }),
    ),
  )
}

function renderBlock(shell: ShellName, env: EnvMap): string {
  const lines = Object.entries(env)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) =>
      shell === 'fish' ? `set -gx ${key} "${value}"` : `export ${key}="${value}"`,
    )

  return [startMarker, ...lines, endMarker, ''].join('\n')
}

function replaceManagedBlock(content: string, block: string): string {
  const pattern = /# >>> cc-env >>>[\s\S]*?# <<< cc-env <<<\n?/
  if (pattern.test(content)) {
    return content.replace(pattern, block)
  }

  return content.length === 0 ? block : `${content.replace(/\n?$/, '\n')}\n${block}`
}

export function createShellEnvService({ homeDir }: { homeDir?: string } = {}) {
  const paths = resolveShellConfigPaths(homeDir)

  async function readContent(path: string): Promise<string> {
    try {
      return await readFile(path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return ''
      }

      throw error
    }
  }

  return {
    async write(env: EnvMap): Promise<ShellWriteRecord[]> {
      return Promise.all(
        (Object.entries(paths) as Array<[ShellName, string]>).map(async ([shell, filePath]) => {
          const content = await readContent(filePath)
          const mergedEnv = envMapSchema.parse({
            ...parseManagedEnv(content),
            ...env,
          })
          await atomicWriteFile(filePath, replaceManagedBlock(content, renderBlock(shell, mergedEnv)))
          return { shell, filePath, env: mergedEnv }
        }),
      )
    },
    async removeKeys(shellWrites: ShellWriteRecord[], keys: string[]): Promise<void> {
      await Promise.all(
        shellWrites.map(async ({ shell, filePath }) => {
          const content = await readContent(filePath)
          const current = parseManagedEnv(content)
          const next = envMapSchema.parse(
            Object.fromEntries(
              Object.entries(current).filter(([key]) => !keys.includes(key)),
            ),
          )
          const block = Object.keys(next).length === 0 ? '' : renderBlock(shell, next)
          await atomicWriteFile(filePath, replaceManagedBlock(content, block))
        }),
      )
    },
  }
}
```

- [ ] **Step 4: Re-run the service tests to verify they pass**

Run: `npm test -- tests/services/claude-shell.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the new services**

```bash
git add src/services/claude-settings-env-service.ts src/services/shell-env-service.ts tests/services/claude-shell.test.ts
git commit -m "feat: add Claude home and shell env services"
```

---

### Task 3: Rewrite init flow and command around required keys and shell migration

**Files:**
- Modify: `src/flows/init-flow.ts`
- Modify: `src/ink/init-app.tsx`
- Modify: `src/commands/init.ts`
- Modify: `src/cli.ts`
- Modify: `tests/flows/init-flow.test.ts`
- Modify: `tests/integration/init-restore.test.ts`

- [ ] **Step 1: Write the failing flow and command tests first**

```ts
import { describe, expect, it } from 'vitest'

import {
  advanceInitFlow,
  createInitFlowState,
} from '../../src/flows/init-flow.js'

describe('init flow', () => {
  it('preselects required keys and does not let them be toggled off', () => {
    const state = createInitFlowState(
      ['ANTHROPIC_AUTH_TOKEN', 'EXTRA_KEY'],
      ['ANTHROPIC_AUTH_TOKEN'],
    )

    expect(state.selectedKeys).toEqual(['ANTHROPIC_AUTH_TOKEN'])

    expect(
      advanceInitFlow(state, {
        type: 'toggle-key',
        key: 'ANTHROPIC_AUTH_TOKEN',
      }).selectedKeys,
    ).toEqual(['ANTHROPIC_AUTH_TOKEN'])
  })

  it('moves directly from key selection to confirm', () => {
    const state = createInitFlowState(['ANTHROPIC_AUTH_TOKEN'], ['ANTHROPIC_AUTH_TOKEN'])

    expect(advanceInitFlow(state, { type: 'continue' }).step).toBe('confirm')
  })
})
```

```ts
import { describe, expect, it, vi } from 'vitest'

import { CliError } from '../../src/core/errors.js'
import { createInitCommand } from '../../src/commands/init.js'

describe('createInitCommand', () => {
  it('migrates effective env from Claude settings into shell blocks and records per-file backups', async () => {
    const claudeSettingsEnvService = {
      read: vi.fn().mockResolvedValue({
        settings: {
          exists: true,
          env: {
            ANTHROPIC_BASE_URL: 'https://settings.example.com',
          },
        },
        settingsLocal: {
          exists: true,
          env: {
            ANTHROPIC_AUTH_TOKEN: 'local-token',
            ANTHROPIC_BASE_URL: 'https://local.example.com',
          },
        },
      }),
      write: vi.fn().mockResolvedValue(undefined),
    }
    const shellEnvService = {
      write: vi.fn().mockResolvedValue([
        {
          shell: 'zsh',
          filePath: '/Users/test/.zshrc',
          env: {
            ANTHROPIC_AUTH_TOKEN: 'local-token',
            ANTHROPIC_BASE_URL: 'https://local.example.com',
          },
        },
      ]),
    }
    const historyService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn().mockResolvedValue({
      confirmed: true,
      selectedKeys: ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'],
    })

    const init = createInitCommand({
      claudeSettingsEnvService,
      shellEnvService,
      historyService,
      renderFlow,
    })

    await expect(init({ yes: false })).resolves.toBeUndefined()

    expect(shellEnvService.write).toHaveBeenCalledWith({
      ANTHROPIC_AUTH_TOKEN: 'local-token',
      ANTHROPIC_BASE_URL: 'https://local.example.com',
    })
    expect(historyService.write).toHaveBeenCalledWith({
      timestamp: expect.any(String),
      action: 'init',
      migratedKeys: ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'],
      settingsBackup: {
        ANTHROPIC_BASE_URL: 'https://settings.example.com',
      },
      settingsLocalBackup: {
        ANTHROPIC_AUTH_TOKEN: 'local-token',
        ANTHROPIC_BASE_URL: 'https://local.example.com',
      },
      shellWrites: [
        {
          shell: 'zsh',
          filePath: '/Users/test/.zshrc',
          env: {
            ANTHROPIC_AUTH_TOKEN: 'local-token',
            ANTHROPIC_BASE_URL: 'https://local.example.com',
          },
        },
      ],
    })
    expect(claudeSettingsEnvService.write).toHaveBeenCalledWith({
      settingsEnv: {},
      settingsLocalEnv: {},
    })
  })

  it('fails when both Claude settings files are missing', async () => {
    const init = createInitCommand({
      claudeSettingsEnvService: {
        read: vi.fn().mockResolvedValue({
          settings: { exists: false, env: {} },
          settingsLocal: { exists: false, env: {} },
        }),
      },
      shellEnvService: { write: vi.fn() },
      historyService: { write: vi.fn() },
      renderFlow: vi.fn(),
    })

    await expect(init({ yes: false })).rejects.toEqual(
      new CliError('Claude settings.json and settings.local.json were not found'),
    )
  })
})
```

- [ ] **Step 2: Run the flow and command tests to verify they fail**

Run: `npm test -- tests/flows/init-flow.test.ts tests/integration/init-restore.test.ts`
Expected: FAIL because `init-flow` still has a preset target step and `createInitCommand` still depends on `presetService` + single-file settings.

- [ ] **Step 3: Implement the minimal flow and command rewrite**

```ts
export type InitFlowState = {
  step: 'keys' | 'confirm' | 'done'
  availableKeys: string[]
  requiredKeys: string[]
  selectedKeys: string[]
}

export type InitFlowAction =
  | { type: 'toggle-key'; key: string }
  | { type: 'continue' }
  | { type: 'confirm' }

export function createInitFlowState(
  availableKeys: string[],
  requiredKeys: string[],
): InitFlowState {
  return {
    step: 'keys',
    availableKeys,
    requiredKeys,
    selectedKeys: requiredKeys,
  }
}

export function advanceInitFlow(state: InitFlowState, action: InitFlowAction): InitFlowState {
  if (state.step === 'keys' && action.type === 'toggle-key') {
    if (state.requiredKeys.includes(action.key)) {
      return state
    }

    const selectedKeys = state.selectedKeys.includes(action.key)
      ? state.selectedKeys.filter((key) => key !== action.key)
      : [...state.selectedKeys, action.key]

    return {
      ...state,
      selectedKeys,
    }
  }

  if (state.step === 'keys' && action.type === 'continue') {
    return {
      ...state,
      step: 'confirm',
    }
  }

  if (state.step === 'confirm' && action.type === 'confirm') {
    return {
      ...state,
      step: 'done',
    }
  }

  return state
}
```

```ts
import { CliError } from '../core/errors.js'
import { envMapSchema, type EnvMap } from '../core/schema.js'

const requiredInitKeys = [
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_REASONING_MODEL',
] as const

function omitKeys(env: EnvMap, keys: string[]): EnvMap {
  return envMapSchema.parse(
    Object.fromEntries(Object.entries(env).filter(([key]) => !keys.includes(key))),
  )
}

export function createInitCommand({
  claudeSettingsEnvService,
  shellEnvService,
  historyService,
  renderFlow,
}: {
  claudeSettingsEnvService: {
    read: () => Promise<{
      settings: { exists: boolean; env: EnvMap }
      settingsLocal: { exists: boolean; env: EnvMap }
    }>
    write: (input: { settingsEnv: EnvMap; settingsLocalEnv: EnvMap }) => Promise<void>
  }
  shellEnvService: {
    write: (env: EnvMap) => Promise<unknown>
  }
  historyService: {
    write: (record: unknown) => Promise<unknown>
  }
  renderFlow: (context: {
    keys: string[]
    requiredKeys: string[]
    yes: boolean
  }) => Promise<{ confirmed?: boolean; selectedKeys: string[] } | void>
}) {
  return async function init({ yes = false }: { yes?: boolean } = {}): Promise<void> {
    const sources = await claudeSettingsEnvService.read()

    if (!sources.settings.exists && !sources.settingsLocal.exists) {
      throw new CliError('Claude settings.json and settings.local.json were not found')
    }

    const effectiveEnv = envMapSchema.parse({
      ...sources.settings.env,
      ...sources.settingsLocal.env,
    })
    const keys = Object.keys(effectiveEnv).sort()
    const requiredKeys = requiredInitKeys.filter((key) => key in effectiveEnv)
    const result = await renderFlow({ keys, requiredKeys, yes })

    if (!result?.confirmed) {
      return
    }

    const migratedEnv = envMapSchema.parse(
      Object.fromEntries(
        result.selectedKeys
          .filter((key) => key in effectiveEnv)
          .map((key) => [key, effectiveEnv[key]]),
      ),
    )

    if (Object.keys(migratedEnv).length === 0) {
      throw new CliError('No selected env values found to migrate')
    }

    const settingsBackup = envMapSchema.parse(
      Object.fromEntries(
        result.selectedKeys
          .filter((key) => key in sources.settings.env)
          .map((key) => [key, sources.settings.env[key]]),
      ),
    )
    const settingsLocalBackup = envMapSchema.parse(
      Object.fromEntries(
        result.selectedKeys
          .filter((key) => key in sources.settingsLocal.env)
          .map((key) => [key, sources.settingsLocal.env[key]]),
      ),
    )

    const timestamp = new Date().toISOString()
    const shellWrites = await shellEnvService.write(migratedEnv)

    await historyService.write({
      timestamp,
      action: 'init',
      migratedKeys: result.selectedKeys,
      settingsBackup,
      settingsLocalBackup,
      shellWrites,
    })

    await claudeSettingsEnvService.write({
      settingsEnv: omitKeys(sources.settings.env, result.selectedKeys),
      settingsLocalEnv: omitKeys(sources.settingsLocal.env, result.selectedKeys),
    })
  }
}
```

- [ ] **Step 4: Re-run the init flow and command tests to verify they pass**

Run: `npm test -- tests/flows/init-flow.test.ts tests/integration/init-restore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the init rewrite**

```bash
git add src/flows/init-flow.ts src/ink/init-app.tsx src/commands/init.ts src/cli.ts tests/flows/init-flow.test.ts tests/integration/init-restore.test.ts
git commit -m "feat: migrate init to Claude shell env flow"
```

---

### Task 4: Redesign restore flow and command for init records

**Files:**
- Modify: `src/flows/restore-flow.ts`
- Modify: `src/ink/restore-app.tsx`
- Modify: `src/commands/restore.ts`
- Modify: `src/cli.ts`
- Modify: `tests/flows/restore-flow.test.ts`
- Modify: `tests/integration/init-restore.test.ts`

- [ ] **Step 1: Write the failing restore tests first**

```ts
import { describe, expect, it } from 'vitest'

import {
  advanceRestoreFlow,
  createRestoreFlowState,
} from '../../src/flows/restore-flow.js'

describe('restore flow', () => {
  it('skips target selection for init history entries', () => {
    const state = createRestoreFlowState([
      {
        timestamp: '2026-04-24T00:00:00.000Z',
        action: 'init',
      },
    ] as any)

    expect(
      advanceRestoreFlow(state, {
        type: 'select-record',
        timestamp: '2026-04-24T00:00:00.000Z',
      }).step,
    ).toBe('confirm')
  })
})
```

```ts
it('restores an init record by removing shell keys and restoring both Claude settings files', async () => {
  const historyService = {
    list: vi.fn().mockResolvedValue([
      {
        timestamp: '2026-04-24T00:00:00.000Z',
        action: 'init',
        migratedKeys: ['ANTHROPIC_AUTH_TOKEN'],
        settingsBackup: {},
        settingsLocalBackup: {
          ANTHROPIC_AUTH_TOKEN: 'local-token',
        },
        shellWrites: [
          {
            shell: 'zsh',
            filePath: '/Users/test/.zshrc',
            env: {
              ANTHROPIC_AUTH_TOKEN: 'local-token',
            },
          },
        ],
      },
    ]),
  }
  const claudeSettingsEnvService = {
    read: vi.fn().mockResolvedValue({
      settings: { exists: true, env: {} },
      settingsLocal: { exists: true, env: {} },
    }),
    write: vi.fn().mockResolvedValue(undefined),
  }
  const shellEnvService = {
    removeKeys: vi.fn().mockResolvedValue(undefined),
  }

  const restore = createRestoreCommand({
    historyService,
    claudeSettingsEnvService,
    shellEnvService,
    presetService: {
      read: vi.fn(),
      write: vi.fn(),
    },
    renderFlow: vi.fn().mockResolvedValue({
      confirmed: true,
      timestamp: '2026-04-24T00:00:00.000Z',
    }),
  })

  await expect(restore({ yes: false })).resolves.toBeUndefined()

  expect(shellEnvService.removeKeys).toHaveBeenCalledWith(
    [
      {
        shell: 'zsh',
        filePath: '/Users/test/.zshrc',
        env: {
          ANTHROPIC_AUTH_TOKEN: 'local-token',
        },
      },
    ],
    ['ANTHROPIC_AUTH_TOKEN'],
  )
  expect(claudeSettingsEnvService.write).toHaveBeenCalledWith({
    settingsEnv: {},
    settingsLocalEnv: {
      ANTHROPIC_AUTH_TOKEN: 'local-token',
    },
  })
})
```

- [ ] **Step 2: Run the restore tests to verify they fail**

Run: `npm test -- tests/flows/restore-flow.test.ts tests/integration/init-restore.test.ts`
Expected: FAIL because `restore-flow` still assumes every record needs a target step and `createRestoreCommand` still restores init entries into settings or presets.

- [ ] **Step 3: Implement the restore flow branching and init restore logic**

```ts
import type { HistoryRecord } from '../core/schema.js'

export type RestoreFlowState = {
  step: 'record' | 'target' | 'confirm' | 'done'
  records: HistoryRecord[]
  selectedTimestamp?: string
  targetType?: 'settings' | 'preset'
  targetName?: string
}

export function createRestoreFlowState(records: HistoryRecord[]): RestoreFlowState {
  return {
    step: 'record',
    records,
  }
}

export function advanceRestoreFlow(
  state: RestoreFlowState,
  action:
    | { type: 'select-record'; timestamp: string }
    | { type: 'select-target'; targetType: 'settings' | 'preset'; targetName?: string }
    | { type: 'confirm' },
): RestoreFlowState {
  if (state.step === 'record' && action.type === 'select-record') {
    const selectedRecord = state.records.find((record) => record.timestamp === action.timestamp)
    if (!selectedRecord) {
      return state
    }

    if (selectedRecord.action === 'init') {
      return {
        ...state,
        selectedTimestamp: action.timestamp,
        step: 'confirm',
      }
    }

    return {
      ...state,
      selectedTimestamp: action.timestamp,
      step: 'target',
    }
  }

  if (state.step === 'target' && action.type === 'select-target') {
    return {
      ...state,
      step: 'confirm',
      targetType: action.targetType,
      targetName: action.targetName,
    }
  }

  if (state.step === 'confirm' && action.type === 'confirm') {
    return {
      ...state,
      step: 'done',
    }
  }

  return state
}
```

```ts
import { CliError } from '../core/errors.js'
import type { EnvMap, HistoryRecord, Preset } from '../core/schema.js'

export function createRestoreCommand({
  historyService,
  claudeSettingsEnvService,
  shellEnvService,
  settingsEnvService,
  presetService,
  renderFlow,
}: {
  historyService: { list: () => Promise<HistoryRecord[]> }
  claudeSettingsEnvService: {
    read: () => Promise<{
      settings: { env: EnvMap }
      settingsLocal: { env: EnvMap }
    }>
    write: (input: { settingsEnv: EnvMap; settingsLocalEnv: EnvMap }) => Promise<void>
  }
  shellEnvService: {
    removeKeys: (shellWrites: any[], keys: string[]) => Promise<void>
  }
  settingsEnvService: {
    read: () => Promise<EnvMap>
    write: (env: EnvMap) => Promise<unknown>
  }
  presetService: {
    read: (name: string) => Promise<Preset>
    write: (preset: Preset) => Promise<unknown>
  }
  renderFlow: (context: { records: HistoryRecord[]; yes: boolean }) => Promise<any>
}) {
  return async function restore({ yes = false }: { yes?: boolean } = {}): Promise<void> {
    const records = await historyService.list()
    const result = await renderFlow({ records, yes })

    if (!result?.confirmed) {
      return
    }

    const record = records.find((entry) => entry.timestamp === result.timestamp)

    if (!record) {
      throw new CliError('Restore record not found')
    }

    if (record.action === 'init') {
      const current = await claudeSettingsEnvService.read()
      await shellEnvService.removeKeys(record.shellWrites, record.migratedKeys)
      await claudeSettingsEnvService.write({
        settingsEnv: {
          ...current.settings.env,
          ...record.settingsBackup,
        },
        settingsLocalEnv: {
          ...current.settingsLocal.env,
          ...record.settingsLocalBackup,
        },
      })
      return
    }

    if (result.targetType === 'settings') {
      const currentSettings = await settingsEnvService.read()
      await settingsEnvService.write({
        ...currentSettings,
        ...record.backup,
      })
      return
    }

    const presetName = result.targetName ?? record.targetName
    const preset = await presetService.read(presetName)

    await presetService.write({
      ...preset,
      updatedAt: new Date().toISOString(),
      env: {
        ...preset.env,
        ...record.backup,
      },
    })
  }
}
```

- [ ] **Step 4: Re-run the restore tests to verify they pass**

Run: `npm test -- tests/flows/restore-flow.test.ts tests/integration/init-restore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the restore rewrite**

```bash
git add src/flows/restore-flow.ts src/ink/restore-app.tsx src/commands/restore.ts src/cli.ts tests/flows/restore-flow.test.ts tests/integration/init-restore.test.ts
git commit -m "feat: restore Claude shell init history"
```

---

### Task 5: Wire the new services into the CLI and verify the full slice

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/ink/init-app.tsx`
- Modify: `src/ink/restore-app.tsx`
- Test: `tests/cli/help.test.ts`
- Test: focused and full suites

- [ ] **Step 1: Add the real service wiring and `--yes` shortcuts in `src/cli.ts`**

```ts
import { join } from 'node:path'

import { resolveGlobalRoot } from './core/paths.js'
import { createClaudeSettingsEnvService } from './services/claude-settings-env-service.js'
import { createShellEnvService } from './services/shell-env-service.js'

const homeDir = process.env.HOME ?? process.cwd()
const cwd = process.cwd()
const settingsPath = join(cwd, 'settings.json')
const globalRoot = resolveGlobalRoot()

const claudeSettingsEnvService = createClaudeSettingsEnvService({ homeDir })
const shellEnvService = createShellEnvService({ homeDir })
```

```ts
program.command('init')
  .option('-y, --yes')
  .action((options) =>
    createInitCommand({
      claudeSettingsEnvService,
      shellEnvService,
      historyService,
      renderFlow: async (context) => {
        render(h(InitApp, context))
        if (context.yes) {
          return {
            confirmed: true,
            selectedKeys: context.requiredKeys,
          }
        }
        return undefined
      },
    })({
      yes: options.yes,
    }),
  )

program.command('restore')
  .option('-y, --yes')
  .action((options) =>
    createRestoreCommand({
      historyService,
      claudeSettingsEnvService,
      shellEnvService,
      settingsEnvService,
      presetService,
      renderFlow: (context) => runRestoreFlow(context),
    })({
      yes: options.yes,
    }),
  )
```

```ts
function runRestoreFlow(context: {
  records: Awaited<ReturnType<typeof historyService.list>>
  yes: boolean
}) {
  const state = createRestoreFlowState(context.records)
  const firstRecord = context.records[0]

  if (!context.yes || !firstRecord) {
    render(h(RestoreApp, { state }))
    return undefined
  }

  const selectedRecordState = advanceRestoreFlow(state, {
    type: 'select-record',
    timestamp: firstRecord.timestamp,
  })

  if (firstRecord.action === 'init') {
    const doneState = advanceRestoreFlow(selectedRecordState, { type: 'confirm' })
    if (doneState.step !== 'done') {
      return undefined
    }
    return {
      confirmed: true,
      timestamp: firstRecord.timestamp,
    }
  }

  const confirmState = advanceRestoreFlow(selectedRecordState, {
    type: 'select-target',
    targetType: firstRecord.targetType,
    ...(firstRecord.targetType === 'preset' ? { targetName: firstRecord.targetName } : {}),
  })

  const doneState = advanceRestoreFlow(confirmState, { type: 'confirm' })
  if (doneState.step !== 'done') {
    return undefined
  }

  return {
    confirmed: true,
    timestamp: firstRecord.timestamp,
    targetType: doneState.targetType,
    targetName: doneState.targetName,
  }
}
```

- [ ] **Step 2: Run the focused migration tests**

Run: `npm test -- tests/core/schema-mask.test.ts tests/core/paths.test.ts tests/services/storage.test.ts tests/services/claude-shell.test.ts tests/flows/init-flow.test.ts tests/flows/restore-flow.test.ts tests/integration/init-restore.test.ts`
Expected: PASS

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Build and smoke-test the CLI**

Run: `npm run build && node dist/cli.js --help`
Expected: PASS and help output still includes `run`, `init`, `restore`, `preset`, and `debug`

- [ ] **Step 5: Commit the integrated redesign**

```bash
git add src/cli.ts src/commands/init.ts src/commands/restore.ts src/flows/init-flow.ts src/flows/restore-flow.ts src/ink/init-app.tsx src/ink/restore-app.tsx src/services/claude-settings-env-service.ts src/services/shell-env-service.ts src/core/schema.ts src/core/paths.ts tests
git commit -m "feat: migrate Claude env into managed shell blocks"
```

---

## Self-Review

### Spec coverage
- Read `~/.claude/settings.json` and `~/.claude/settings.local.json`: Task 2 and Task 3
- `settings.local.json` precedence: Task 3 command tests and implementation
- Required six keys preselected and non-removable: Task 3 flow tests and flow implementation
- No preset creation in `init`: Task 3 command rewrite
- Managed zsh/bash/fish blocks: Task 2 service tests and implementation
- Per-file init backups and shell writes in history: Task 1 schema/storage changes and Task 3 history write
- Dual restore for init records: Task 4
- New terminal sessions only, no live shell mutation: Task 2 shell service behavior and Task 5 CLI wiring
- Leave non-init restore behavior intact: Task 4 keeps restore target handling for `action: 'restore'`

### Placeholder scan
- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task has exact files, targeted commands, expected failures, and concrete code snippets.

### Type consistency
- Init history uses `migratedKeys`, `settingsBackup`, `settingsLocalBackup`, and `shellWrites` everywhere.
- Non-init restore records keep `backup`, `targetType`, and `targetName`.
- `claudeSettingsEnvService.write` consistently takes `{ settingsEnv, settingsLocalEnv }`.
- `shellEnvService.removeKeys` consistently takes `(shellWrites, keys)`.
