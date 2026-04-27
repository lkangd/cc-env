import { rm } from 'node:fs/promises'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRunCommand } from '../../src/commands/run.js'
import { CliError } from '../../src/core/errors.js'
import type { EnvMap } from '../../src/core/schema.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const emptySettingsSources = [
  { path: '/home/.claude/settings.json', exists: false, env: {} as EnvMap },
  { path: '/home/.claude/settings.local.json', exists: false, env: {} as EnvMap },
  { path: '/project/.claude/settings.json', exists: false, env: {} as EnvMap },
  { path: '/project/.claude/settings.local.json', exists: false, env: {} as EnvMap },
]

type PresetRef = { presetName: string; source: 'global' | 'project' }
type PresetSelectItem = { name: string; env: EnvMap; source: 'global' | 'project' }

function createMocks(overrides: Partial<{
  claudeSettingsEnvService: { read: () => Promise<typeof emptySettingsSources> }
  presetService: { listNames: () => Promise<string[]>; read: (name: string) => Promise<{ env: EnvMap }> }
  projectEnvService: { readWithMeta: () => Promise<{ env: EnvMap; name?: string | undefined }> }
  projectStateService: { getLastPreset: (cwd: string) => Promise<PresetRef | undefined>; saveLastPreset: (cwd: string, ref: PresetRef) => Promise<void> }
  findClaude: () => string
  renderPresetSelect: (input: { presets: Array<PresetSelectItem>; defaultIndex: number }) => Promise<PresetSelectItem | undefined>
  spawnCommand: (command: string, args: string[], env: NodeJS.ProcessEnv) => Promise<void>
  stdout: Pick<NodeJS.WriteStream, 'write'>
}> = {}) {
  const defaultPreset = { env: { OPENAI_API_KEY: 'sk-1234567890' } as EnvMap }
  const presetItem = { name: 'openai', env: defaultPreset.env, source: 'global' as const }

  return {
    claudeSettingsEnvService: overrides.claudeSettingsEnvService ?? {
      read: vi.fn().mockResolvedValue(emptySettingsSources),
    },
    presetService: overrides.presetService ?? {
      listNames: vi.fn().mockResolvedValue(['openai']),
      read: vi.fn().mockResolvedValue(defaultPreset),
    },
    projectEnvService: overrides.projectEnvService ?? {
      readWithMeta: vi.fn().mockResolvedValue({ env: {} as EnvMap }),
    },
    projectStateService: overrides.projectStateService ?? {
      getLastPreset: vi.fn().mockResolvedValue(undefined),
      saveLastPreset: vi.fn().mockResolvedValue(undefined),
    },
    findClaude: overrides.findClaude ?? vi.fn().mockReturnValue('/usr/local/bin/claude'),
    renderPresetSelect: overrides.renderPresetSelect ?? vi.fn().mockResolvedValue(presetItem),
    spawnCommand: overrides.spawnCommand ?? vi.fn().mockResolvedValue(undefined),
    stdout: overrides.stdout ?? { write: vi.fn() },
  }
}

function buildRun(mocks: ReturnType<typeof createMocks>) {
  return createRunCommand({
    claudeSettingsEnvService: mocks.claudeSettingsEnvService,
    presetService: mocks.presetService,
    projectEnvService: mocks.projectEnvService,
    projectStateService: mocks.projectStateService,
    findClaude: mocks.findClaude,
    renderPresetSelect: mocks.renderPresetSelect,
    spawnCommand: mocks.spawnCommand,
    stdout: mocks.stdout,
  })
}

describe('createRunCommand', () => {
  it('throws when init-managed keys found in Claude settings', async () => {
    const staleSources = emptySettingsSources.map((s, i) =>
      i === 0 ? { ...s, exists: true, env: { ANTHROPIC_AUTH_TOKEN: 'sk-old' } as EnvMap } : s,
    )
    const mocks = createMocks({
      claudeSettingsEnvService: { read: vi.fn().mockResolvedValue(staleSources) },
    })

    await expect(buildRun(mocks)({ cwd: '/project' })).rejects.toEqual(
      new CliError('Found init-managed keys in Claude settings:\n\n  ANTHROPIC_AUTH_TOKEN. \n\n  Run "cc-env init" first.'),
    )
  })

  it('throws when no presets exist', async () => {
    const mocks = createMocks({
      presetService: {
        listNames: vi.fn().mockResolvedValue([]),
        read: vi.fn(),
      },
      projectEnvService: {
        readWithMeta: vi.fn().mockResolvedValue({ env: {} as EnvMap }),
      },
    })

    await expect(buildRun(mocks)({ cwd: '/project' })).rejects.toEqual(
      new CliError('No presets found. Create one with "cc-env preset create".'),
    )
  })

  it('returns cleanly when user cancels preset selection', async () => {
    const mocks = createMocks({
      renderPresetSelect: vi.fn().mockResolvedValue(undefined),
    })

    await buildRun(mocks)({ cwd: '/project' })

    expect(mocks.spawnCommand).not.toHaveBeenCalled()
    expect(mocks.projectStateService.saveLastPreset).not.toHaveBeenCalled()
  })

  it('auto-finds claude when no args provided', async () => {
    const mocks = createMocks({
      findClaude: vi.fn().mockReturnValue('/usr/local/bin/claude'),
    })

    await buildRun(mocks)({ args: [], cwd: '/project' })

    expect(mocks.findClaude).toHaveBeenCalled()
    expect(mocks.spawnCommand).toHaveBeenCalledWith(
      '/usr/local/bin/claude',
      [],
      expect.objectContaining({ OPENAI_API_KEY: 'sk-1234567890' }),
    )
  })

  it('uses claude directly when args[0] is "claude"', async () => {
    const mocks = createMocks()

    await buildRun(mocks)({ args: ['claude', '--model', 'opus'], cwd: '/project' })

    expect(mocks.findClaude).not.toHaveBeenCalled()
    expect(mocks.spawnCommand).toHaveBeenCalledWith(
      'claude',
      ['--model', 'opus'],
      expect.objectContaining({ OPENAI_API_KEY: 'sk-1234567890' }),
    )
  })

  it('saves last-selected preset after selection', async () => {
    const mocks = createMocks()

    await buildRun(mocks)({ cwd: '/project' })

    expect(mocks.projectStateService.saveLastPreset).toHaveBeenCalledWith('/project', {
      presetName: 'openai',
      source: 'global',
    })
  })

  it('uses saved preset as default selection index', async () => {
    const mocks = createMocks({
      projectStateService: {
        getLastPreset: vi.fn().mockResolvedValue({ presetName: 'openai', source: 'global' }),
        saveLastPreset: vi.fn().mockResolvedValue(undefined),
      },
    })

    await buildRun(mocks)({ cwd: '/project' })

    expect(mocks.renderPresetSelect).toHaveBeenCalledWith(
      expect.objectContaining({ defaultIndex: 0 }),
    )
  })

  it('falls back to index 0 when saved preset no longer exists', async () => {
    const mocks = createMocks({
      projectStateService: {
        getLastPreset: vi.fn().mockResolvedValue({ presetName: 'deleted', source: 'global' }),
        saveLastPreset: vi.fn().mockResolvedValue(undefined),
      },
    })

    await buildRun(mocks)({ cwd: '/project' })

    expect(mocks.renderPresetSelect).toHaveBeenCalledWith(
      expect.objectContaining({ defaultIndex: 0 }),
    )
  })

  it('prints env vars and preset info before spawning', async () => {
    const mocks = createMocks()

    await buildRun(mocks)({ args: ['claude'], cwd: '/project' })

    expect(mocks.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining('Using preset: openai (global)'),
    )
    expect(mocks.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining('OPENAI_API_KEY=sk-123456********'),
    )
  })

  it('prints would-run in dry-run mode without spawning', async () => {
    const mocks = createMocks()

    await buildRun(mocks)({ args: ['claude', '--model', 'opus'], dryRun: true, cwd: '/project' })

    expect(mocks.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining('Would run: claude --model opus'),
    )
    expect(mocks.spawnCommand).not.toHaveBeenCalled()
  })

  it('auto-selects default preset in yes mode without rendering UI', async () => {
    const mocks = createMocks()

    await buildRun(mocks)({ yes: true, cwd: '/project' })

    expect(mocks.renderPresetSelect).not.toHaveBeenCalled()
    expect(mocks.projectStateService.saveLastPreset).toHaveBeenCalledWith('/project', {
      presetName: 'openai',
      source: 'global',
    })
  })
})
