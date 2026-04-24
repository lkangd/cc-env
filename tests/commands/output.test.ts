import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDebugCommand } from '../../src/commands/debug.js'
import { createShowPresetCommand } from '../../src/commands/preset/show.js'
import { formatEnvBlock } from '../../src/core/format.js'

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
