import { describe, expect, it, vi } from 'vitest'

import { createInitCommand } from '../../src/commands/init.js'
import { createRestoreCommand } from '../../src/commands/restore.js'

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

describe('createRestoreCommand', () => {
  it('restores a history record into settings', async () => {
    const historyService = {
      list: vi.fn().mockResolvedValue([
        {
          timestamp: '2026-04-24T00:00:00.000Z',
          action: 'init',
          targetType: 'preset',
          targetName: 'openai',
          backup: {
            OPENAI_API_KEY: 'sk-123',
          },
        },
      ]),
    }
    const settingsEnvService = {
      read: vi.fn().mockResolvedValue({
        BASE_URL: 'https://api.openai.com',
      }),
      write: vi.fn().mockResolvedValue(undefined),
    }
    const presetService = {
      read: vi.fn(),
      write: vi.fn(),
    }
    const renderFlow = vi.fn().mockResolvedValue({
      confirmed: true,
      timestamp: '2026-04-24T00:00:00.000Z',
      targetType: 'settings',
    })

    const restore = createRestoreCommand({
      historyService,
      settingsEnvService,
      presetService,
      renderFlow,
    })

    await expect(restore({ yes: false })).resolves.toBeUndefined()

    expect(historyService.list).toHaveBeenCalledWith()
    expect(renderFlow).toHaveBeenCalledWith({
      records: [
        {
          timestamp: '2026-04-24T00:00:00.000Z',
          action: 'init',
          targetType: 'preset',
          targetName: 'openai',
          backup: {
            OPENAI_API_KEY: 'sk-123',
          },
        },
      ],
      yes: false,
    })
    expect(settingsEnvService.write).toHaveBeenCalledWith({
      BASE_URL: 'https://api.openai.com',
      OPENAI_API_KEY: 'sk-123',
    })
    expect(presetService.read).not.toHaveBeenCalled()
    expect(presetService.write).not.toHaveBeenCalled()
  })

  it('restores a history record into a preset', async () => {
    const historyService = {
      list: vi.fn().mockResolvedValue([
        {
          timestamp: '2026-04-24T00:00:00.000Z',
          action: 'init',
          targetType: 'preset',
          targetName: 'openai',
          backup: {
            OPENAI_API_KEY: 'sk-123',
          },
        },
      ]),
    }
    const settingsEnvService = {
      read: vi.fn(),
      write: vi.fn(),
    }
    const presetService = {
      read: vi.fn().mockResolvedValue({
        name: 'openai',
        createdAt: '2026-04-24T00:00:00.000Z',
        updatedAt: '2026-04-24T00:00:00.000Z',
        env: {
          BASE_URL: 'https://api.openai.com',
        },
      }),
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn().mockResolvedValue({
      confirmed: true,
      timestamp: '2026-04-24T00:00:00.000Z',
      targetType: 'preset',
      targetName: 'openai',
    })

    const restore = createRestoreCommand({
      historyService,
      settingsEnvService,
      presetService,
      renderFlow,
    })

    await expect(restore({ yes: false })).resolves.toBeUndefined()

    expect(presetService.read).toHaveBeenCalledWith('openai')
    expect(presetService.write).toHaveBeenCalledWith({
      name: 'openai',
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: expect.any(String),
      env: {
        BASE_URL: 'https://api.openai.com',
        OPENAI_API_KEY: 'sk-123',
      },
    })
    expect(settingsEnvService.read).not.toHaveBeenCalled()
    expect(settingsEnvService.write).not.toHaveBeenCalled()
  })
})
