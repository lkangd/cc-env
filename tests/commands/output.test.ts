import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderEnvSummary } from '../../src/ink/summary.js'

import { createDebugCommand } from '../../src/commands/debug.js'
import { createDeletePresetCommand } from '../../src/commands/preset/delete.js'
import { createEditPresetCommand } from '../../src/commands/preset/edit.js'
import { CliError } from '../../src/core/errors.js'
import { formatEnvBlock, formatRestorePreview } from '../../src/core/format.js'

const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

vi.mock('../../src/ink/summary.js', () => ({
  renderEnvSummary: vi.fn().mockResolvedValue(undefined),
}))

afterEach(() => {
  logSpy.mockClear()
})

describe('formatEnvBlock', () => {
  it('masks sensitive values', () => {
    expect(
      formatEnvBlock({
        OPENAI_API_KEY: 'sk-1234567890',
        BASE_URL: 'https://api.openai.com',
      }),
    ).toBe('BASE_URL=https://api.openai.com\nOPENAI_API_KEY=sk-123456********')
  })
})

describe('formatRestorePreview', () => {
  it('shows restore values as newline-delimited key=value entries without masking', () => {
    expect(
      formatRestorePreview({
        OPENAI_API_KEY: 'sk-123',
        BASE_URL: 'https://api.openai.com',
      }),
    ).toBe('BASE_URL=https://api.openai.com\nOPENAI_API_KEY=sk-123')
  })
})

describe('createDeletePresetCommand', () => {
  it('deletes selected global preset and prints success message', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const deletePreset = createDeletePresetCommand({
      presetService: {
        listNames: vi.fn().mockResolvedValue(['openai', 'anthropic']),
        read: vi.fn().mockResolvedValue({ env: { API_KEY: 'test' } }),
        remove,
      },
      projectEnvService: {
        readWithMeta: vi.fn().mockResolvedValue({ env: {} }),
        write: vi.fn(),
      },
      renderDelete: vi.fn().mockResolvedValue({ name: 'anthropic', env: { API_KEY: 'test' }, source: 'global' }),
    })

    await deletePreset()

    expect(remove).toHaveBeenCalledWith('anthropic')
    expect(logSpy).toHaveBeenCalledWith('Deleted preset: anthropic')
  })

  it('deletes project preset by writing empty env', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const write = vi.fn().mockResolvedValue({})
    const deletePreset = createDeletePresetCommand({
      presetService: {
        listNames: vi.fn().mockResolvedValue([]),
        read: vi.fn(),
        remove,
      },
      projectEnvService: {
        readWithMeta: vi.fn().mockResolvedValue({ env: { KEY: 'val' }, name: 'my-proj' }),
        write,
      },
      renderDelete: vi.fn().mockResolvedValue({ name: 'my-proj', env: { KEY: 'val' }, source: 'project' }),
    })

    await deletePreset()

    expect(write).toHaveBeenCalledWith({})
    expect(remove).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith('Deleted preset: my-proj')
  })

  it('prints message when no presets exist', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const deletePreset = createDeletePresetCommand({
      presetService: {
        listNames: vi.fn().mockResolvedValue([]),
        read: vi.fn(),
        remove,
      },
      projectEnvService: {
        readWithMeta: vi.fn().mockResolvedValue({ env: {} }),
        write: vi.fn(),
      },
      renderDelete: vi.fn(),
    })

    await deletePreset()

    expect(logSpy).toHaveBeenCalledWith('No presets found.')
    expect(remove).not.toHaveBeenCalled()
  })

  it('does nothing when user cancels', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const deletePreset = createDeletePresetCommand({
      presetService: {
        listNames: vi.fn().mockResolvedValue(['openai']),
        read: vi.fn().mockResolvedValue({ env: { API_KEY: 'test' } }),
        remove,
      },
      projectEnvService: {
        readWithMeta: vi.fn().mockResolvedValue({ env: {} }),
        write: vi.fn(),
      },
      renderDelete: vi.fn().mockResolvedValue(undefined),
    })

    await deletePreset()

    expect(remove).not.toHaveBeenCalled()
  })
})

describe('createEditPresetCommand', () => {
  it('throws when EDITOR is missing', async () => {
    const editPreset = createEditPresetCommand({
      presetService: {
        read: vi.fn(),
      },
      processEnv: {},
      spawnSync: vi.fn(),
    })

    await expect(editPreset('openai')).rejects.toEqual(
      new CliError('EDITOR is required to edit a preset'),
    )
  })

  it('opens the preset file with the configured editor', async () => {
    const spawnSyncMock = vi.fn().mockReturnValue({ status: 0 })
    const editPreset = createEditPresetCommand({
      presetService: {
        read: vi.fn().mockResolvedValue({
          filePath: '/tmp/openai.json',
        }),
      },
      processEnv: { EDITOR: 'code' },
      spawnSync: spawnSyncMock,
    })

    await editPreset('openai')

    expect(spawnSyncMock).toHaveBeenCalledWith('code', ['/tmp/openai.json'], {
      stdio: 'inherit',
    })
  })

  it('throws when the editor exits with a nonzero code', async () => {
    const editPreset = createEditPresetCommand({
      presetService: {
        read: vi.fn().mockResolvedValue({
          filePath: '/tmp/openai.json',
        }),
      },
      processEnv: { EDITOR: 'vim' },
      spawnSync: vi.fn().mockReturnValue({ status: 2 }),
    })

    await expect(editPreset('openai')).rejects.toEqual(
      new CliError('Editor exited with code 2'),
    )
  })
})

describe('createDebugCommand', () => {
  it('prints merged env containing BASE_URL', async () => {
    const debug = createDebugCommand({
      settingsEnvService: {
        read: vi.fn().mockResolvedValue({
          OPENAI_API_KEY: 'sk-settings',
        }),
      },
      projectEnvService: {
        read: vi.fn().mockResolvedValue({
          BASE_URL: 'https://api.openai.com',
        }),
      },
      runtimeEnvService: {
        merge: vi.fn().mockReturnValue({
          OPENAI_API_KEY: 'sk-settings',
          BASE_URL: 'https://api.openai.com',
        }),
      },
      processEnv: {},
      presetEnv: {},
    })

    await debug()

    expect(renderEnvSummary).toHaveBeenCalledWith({
      title: 'Merged Environment',
      description: 'Final env after merging: process + settings + project + preset',
      env: {
        OPENAI_API_KEY: 'sk-settings',
        BASE_URL: 'https://api.openai.com',
      },
    })
  })
})
