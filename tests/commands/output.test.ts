import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDebugCommand } from '../../src/commands/debug.js'
import { createDeletePresetCommand } from '../../src/commands/preset/delete.js'
import { createEditPresetCommand } from '../../src/commands/preset/edit.js'
import { createShowPresetCommand } from '../../src/commands/preset/show.js'
import { CliError } from '../../src/core/errors.js'
import { formatEnvBlock, formatRestorePreview } from '../../src/core/format.js'

const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

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

describe('createShowPresetCommand', () => {
  it('prints a preset with masked secrets', async () => {
    const showPreset = createShowPresetCommand({
      presetService: {
        read: vi.fn().mockResolvedValue({
          name: 'openai',
          filePath: '/tmp/openai.json',
          createdAt: '2026-04-24T00:00:00.000Z',
          updatedAt: '2026-04-24T00:00:00.000Z',
          env: {
            OPENAI_API_KEY: 'sk-1234567890',
            BASE_URL: 'https://api.openai.com',
          },
        }),
      },
    })

    await showPreset('openai')

    expect(logSpy).toHaveBeenCalledWith(
      ['Preset: openai', 'BASE_URL=https://api.openai.com', 'OPENAI_API_KEY=sk-123456********'].join('\n'),
    )
  })
})

describe('createDeletePresetCommand', () => {
  it('prints a success message after deleting a preset', async () => {
    const deletePreset = createDeletePresetCommand({
      presetService: {
        remove: vi.fn().mockResolvedValue(undefined),
      },
    })

    await deletePreset('openai')

    expect(logSpy).toHaveBeenCalledWith('Deleted preset: openai')
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

    expect(logSpy).toHaveBeenCalledWith(
      ['BASE_URL=https://api.openai.com', 'OPENAI_API_KEY=sk-settin********'].join('\n'),
    )
  })
})
