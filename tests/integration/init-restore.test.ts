import { describe, expect, it, vi } from 'vitest'

import { createInitCommand } from '../../src/commands/init.js'

describe('createInitCommand', () => {
  it('resolves successfully when selected keys move into a preset and settings are updated', async () => {
    const settingsEnvService = {
      read: vi.fn().mockResolvedValue({
        OPENAI_API_KEY: 'sk-123',
        BASE_URL: 'https://api.openai.com',
      }),
      write: vi.fn().mockResolvedValue(undefined),
    }
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const historyService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn().mockResolvedValue({
      selectedKeys: ['OPENAI_API_KEY'],
      confirmed: true,
      presetName: 'openai',
    })

    const init = createInitCommand({
      settingsEnvService,
      presetService,
      historyService,
      renderFlow,
    })

    await expect(init({ yes: false })).resolves.toBeUndefined()

    expect(renderFlow).toHaveBeenCalledWith({
      keys: ['OPENAI_API_KEY', 'BASE_URL'],
      yes: false,
    })
    expect(presetService.write).toHaveBeenCalledWith('openai', {
      OPENAI_API_KEY: 'sk-123',
    })
    expect(historyService.write).toHaveBeenCalledWith({
      timestamp: expect.any(String),
      action: 'init',
      movedKeys: ['OPENAI_API_KEY'],
      backup: {
        OPENAI_API_KEY: 'sk-123',
      },
      targetType: 'preset',
      targetName: 'openai',
    })
    expect(settingsEnvService.write).toHaveBeenCalledWith({
      BASE_URL: 'https://api.openai.com',
    })
  })
})
