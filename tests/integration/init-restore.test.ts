import { describe, expect, it, vi } from 'vitest'

import { createInitCommand } from '../../src/commands/init.js'
import { createRestoreCommand } from '../../src/commands/restore.js'

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

    expect(renderFlow).toHaveBeenCalledWith({
      keys: ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'],
      requiredKeys: ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'],
      yes: false,
    })
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

    await expect(init({ yes: false })).rejects.toMatchObject({
      message: 'Claude settings.json and settings.local.json were not found',
      exitCode: 1,
    })
  })
})

describe('createRestoreCommand', () => {
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
    const presetService = {
      read: vi.fn(),
      write: vi.fn(),
    }
    const renderFlow = vi.fn().mockResolvedValue({
      confirmed: true,
      timestamp: '2026-04-24T00:00:00.000Z',
    })

    const restore = createRestoreCommand({
      historyService,
      claudeSettingsEnvService,
      shellEnvService,
      settingsEnvService: {
        read: vi.fn(),
        write: vi.fn(),
      },
      presetService,
      renderFlow,
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
    expect(presetService.read).not.toHaveBeenCalled()
    expect(presetService.write).not.toHaveBeenCalled()
  })

  it('restores a non-init history record into a preset', async () => {
    const historyService = {
      list: vi.fn().mockResolvedValue([
        {
          timestamp: '2026-04-25T00:00:00.000Z',
          action: 'restore',
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
      timestamp: '2026-04-25T00:00:00.000Z',
      targetType: 'preset',
      targetName: 'openai',
    })

    const restore = createRestoreCommand({
      historyService,
      claudeSettingsEnvService: {
        read: vi.fn(),
        write: vi.fn(),
      },
      shellEnvService: {
        removeKeys: vi.fn(),
      },
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
