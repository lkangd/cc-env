import { describe, expect, it, vi } from 'vitest'

import { createInitCommand } from '../../src/commands/init.js'
import { createRestoreCommand } from '../../src/commands/restore.js'
import { historySchema } from '../../src/core/schema.js'

const globalSettingsPath = '/Users/test/.claude/settings.json'
const globalSettingsLocalPath = '/Users/test/.claude/settings.local.json'
const projectSettingsPath = '/project/.claude/settings.json'
const projectSettingsLocalPath = '/project/.claude/settings.local.json'

const allPaths = [globalSettingsPath, globalSettingsLocalPath, projectSettingsPath, projectSettingsLocalPath]

describe('history schema', () => {
  it('accepts preset-create history records', () => {
    expect(() =>
      historySchema.parse({
        timestamp: '2026-04-29T12:00:00.000Z',
        action: 'preset-create',
        presetName: 'claude-prod',
        destination: 'global',
        migratedKeys: ['ANTHROPIC_AUTH_TOKEN'],
        sources: [
          {
            file: globalSettingsPath,
            backup: { ANTHROPIC_AUTH_TOKEN: 'token' },
          },
        ],
      }),
    ).not.toThrow()
  })
})

describe('createInitCommand', () => {
  it('continues to pass the shared required Claude keys into init flow', async () => {
    const claudeSettingsEnvService = {
      read: vi.fn().mockResolvedValue([
        { path: globalSettingsPath, exists: true, env: { ANTHROPIC_AUTH_TOKEN: 'token' } },
        { path: globalSettingsLocalPath, exists: false, env: {} },
        { path: projectSettingsPath, exists: false, env: {} },
        { path: projectSettingsLocalPath, exists: false, env: {} },
      ]),
      write: vi.fn().mockResolvedValue(undefined),
    }
    const shellEnvService = {
      write: vi.fn().mockResolvedValue([
        {
          shell: 'zsh',
          filePath: '/Users/test/.zshrc',
          env: { ANTHROPIC_AUTH_TOKEN: 'token' },
        },
      ]),
    }
    const historyService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn().mockResolvedValue({
      confirmed: true,
      selectedKeys: ['ANTHROPIC_AUTH_TOKEN'],
    })

    const init = createInitCommand({
      claudeSettingsEnvService,
      shellEnvService,
      historyService,
      renderFlow,
      renderEnvSummary: vi.fn().mockResolvedValue(undefined),
    })

    await init({ yes: false })

    expect(renderFlow).toHaveBeenCalledWith(
      expect.objectContaining({ requiredKeys: ['ANTHROPIC_AUTH_TOKEN'] }),
    )
  })

  it('migrates effective env from Claude settings into shell blocks and records per-file backups', async () => {
    const claudeSettingsEnvService = {
      read: vi.fn().mockResolvedValue([
        { path: globalSettingsPath, exists: true, env: { ANTHROPIC_BASE_URL: 'https://settings.example.com' } },
        { path: globalSettingsLocalPath, exists: true, env: { ANTHROPIC_AUTH_TOKEN: 'local-token', ANTHROPIC_BASE_URL: 'https://local.example.com' } },
        { path: projectSettingsPath, exists: false, env: {} },
        { path: projectSettingsLocalPath, exists: false, env: {} },
      ]),
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
      renderEnvSummary: vi.fn().mockResolvedValue(undefined),
    })

    await expect(init({ yes: false })).resolves.toBeUndefined()

    expect(renderFlow).toHaveBeenCalledWith({
      keys: ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'],
      requiredKeys: ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'],
      sourceFiles: allPaths,
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
      sources: [
        {
          file: globalSettingsPath,
          backup: {
            ANTHROPIC_BASE_URL: 'https://settings.example.com',
          },
        },
        {
          file: globalSettingsLocalPath,
          backup: {
            ANTHROPIC_AUTH_TOKEN: 'local-token',
            ANTHROPIC_BASE_URL: 'https://local.example.com',
          },
        },
        {
          file: projectSettingsPath,
          backup: {},
        },
        {
          file: projectSettingsLocalPath,
          backup: {},
        },
      ],
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
    expect(claudeSettingsEnvService.write).toHaveBeenCalledWith([
      { path: globalSettingsPath, env: {} },
      { path: globalSettingsLocalPath, env: {} },
      { path: projectSettingsPath, env: {} },
      { path: projectSettingsLocalPath, env: {} },
    ])
  })

  it('fails when all Claude settings files are missing', async () => {
    const init = createInitCommand({
      claudeSettingsEnvService: {
        read: vi.fn().mockResolvedValue([
          { path: globalSettingsPath, exists: false, env: {} },
          { path: globalSettingsLocalPath, exists: false, env: {} },
          { path: projectSettingsPath, exists: false, env: {} },
          { path: projectSettingsLocalPath, exists: false, env: {} },
        ]),
        write: vi.fn(),
      },
      shellEnvService: { write: vi.fn() },
      historyService: { write: vi.fn() },
      renderFlow: vi.fn(),
      renderEnvSummary: vi.fn().mockResolvedValue(undefined),
    })

    await expect(init({ yes: false })).rejects.toMatchObject({
      message: 'No Claude settings files were found',
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
          sources: [
            {
              file: globalSettingsPath,
              backup: {},
            },
            {
              file: globalSettingsLocalPath,
              backup: {
                ANTHROPIC_AUTH_TOKEN: 'local-token',
              },
            },
          ],
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
      read: vi.fn().mockResolvedValue([
        { path: globalSettingsPath, exists: true, env: {} },
        { path: globalSettingsLocalPath, exists: true, env: {} },
        { path: projectSettingsPath, exists: false, env: {} },
        { path: projectSettingsLocalPath, exists: false, env: {} },
      ]),
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
      renderEnvSummary: vi.fn().mockResolvedValue(undefined),
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
    expect(claudeSettingsEnvService.write).toHaveBeenCalledWith([
      { path: globalSettingsPath, env: {} },
      { path: globalSettingsLocalPath, env: { ANTHROPIC_AUTH_TOKEN: 'local-token' } },
      { path: projectSettingsPath, env: {} },
      { path: projectSettingsLocalPath, env: {} },
    ])
    expect(presetService.read).not.toHaveBeenCalled()
    expect(presetService.write).not.toHaveBeenCalled()
  })

  it('restores the selected latest init record including extra migrated keys', async () => {
    const historyService = {
      list: vi.fn().mockResolvedValue([
        {
          timestamp: '2026-04-24T00:00:00.000Z',
          action: 'init',
          migratedKeys: ['ANTHROPIC_AUTH_TOKEN'],
          sources: [
            {
              file: globalSettingsPath,
              backup: {},
            },
            {
              file: globalSettingsLocalPath,
              backup: {
                ANTHROPIC_AUTH_TOKEN: 'old-local-token',
              },
            },
          ],
          shellWrites: [
            {
              shell: 'fish',
              filePath: '/Users/test/.config/fish/config.fish',
              env: {
                ANTHROPIC_AUTH_TOKEN: 'old-local-token',
              },
            },
          ],
        },
        {
          timestamp: '2026-04-25T00:00:00.000Z',
          action: 'init',
          migratedKeys: ['ANTHROPIC_AUTH_TOKEN', 'API_TIMEOUT_MS'],
          sources: [
            {
              file: globalSettingsPath,
              backup: {},
            },
            {
              file: globalSettingsLocalPath,
              backup: {
                ANTHROPIC_AUTH_TOKEN: 'local-token',
                API_TIMEOUT_MS: '3000000',
              },
            },
          ],
          shellWrites: [
            {
              shell: 'fish',
              filePath: '/Users/test/.config/fish/config.fish',
              env: {
                ANTHROPIC_AUTH_TOKEN: 'local-token',
                API_TIMEOUT_MS: '3000000',
              },
            },
          ],
        },
      ]),
    }
    const claudeSettingsEnvService = {
      read: vi.fn().mockResolvedValue([
        { path: globalSettingsPath, exists: true, env: {} },
        { path: globalSettingsLocalPath, exists: true, env: {} },
        { path: projectSettingsPath, exists: false, env: {} },
        { path: projectSettingsLocalPath, exists: false, env: {} },
      ]),
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
      timestamp: '2026-04-25T00:00:00.000Z',
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
      renderEnvSummary: vi.fn().mockResolvedValue(undefined),
      renderFlow,
    })

    await expect(restore({ yes: false })).resolves.toBeUndefined()

    expect(shellEnvService.removeKeys).toHaveBeenCalledWith(
      [
        {
          shell: 'fish',
          filePath: '/Users/test/.config/fish/config.fish',
          env: {
            ANTHROPIC_AUTH_TOKEN: 'local-token',
            API_TIMEOUT_MS: '3000000',
          },
        },
      ],
      ['ANTHROPIC_AUTH_TOKEN', 'API_TIMEOUT_MS'],
    )
    expect(claudeSettingsEnvService.write).toHaveBeenCalledWith([
      { path: globalSettingsPath, env: {} },
      { path: globalSettingsLocalPath, env: { ANTHROPIC_AUTH_TOKEN: 'local-token', API_TIMEOUT_MS: '3000000' } },
      { path: projectSettingsPath, env: {} },
      { path: projectSettingsLocalPath, env: {} },
    ])
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
      renderEnvSummary: vi.fn().mockResolvedValue(undefined),
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
