import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi, afterEach } from 'vitest'

import { createPresetCreateCommand, readEnvFile } from '../../src/commands/preset/create.js'
import { CliError } from '../../src/core/errors.js'

const tempRoots: string[] = []

async function createTempRoot() {
  const root = await mkdtemp(join(tmpdir(), 'cc-env-create-'))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('readEnvFile', () => {
  it('reads a flat JSON file', async () => {
    const root = await createTempRoot()
    const file = join(root, 'env.json')
    await writeFile(file, JSON.stringify({ API_KEY: 'secret', PORT: '3000' }))

    const result = await readEnvFile(file)
    expect(result.allKeys).toEqual(['API_KEY', 'PORT'])
    expect(result.env).toEqual({ API_KEY: 'secret', PORT: '3000' })
  })

  it('extracts from nested env field in JSON', async () => {
    const root = await createTempRoot()
    const file = join(root, 'env.json')
    await writeFile(file, JSON.stringify({ env: { API_KEY: 'secret' }, other: true }))

    const result = await readEnvFile(file)
    expect(result.allKeys).toEqual(['API_KEY'])
    expect(result.env).toEqual({ API_KEY: 'secret' })
  })

  it('falls back to top-level when env is not an object', async () => {
    const root = await createTempRoot()
    const file = join(root, 'env.json')
    await writeFile(file, JSON.stringify({ env: 'not-an-object', API_KEY: 'secret' }))

    const result = await readEnvFile(file)
    expect(result.env).toEqual({ API_KEY: 'secret' })
  })

  it('reads a YAML file', async () => {
    const root = await createTempRoot()
    const file = join(root, 'env.yaml')
    await writeFile(file, 'API_KEY: secret\nPORT: "3000"\n')

    const result = await readEnvFile(file)
    expect(result.allKeys).toEqual(['API_KEY', 'PORT'])
    expect(result.env).toEqual({ API_KEY: 'secret', PORT: '3000' })
  })

  it('throws for unsupported file extensions', async () => {
    const root = await createTempRoot()
    const file = join(root, 'env.toml')
    await writeFile(file, 'content')

    await expect(readEnvFile(file)).rejects.toThrowError(
      new CliError('Unsupported file format: .toml', 2),
    )
  })

  it('throws CliError for unreadable files', async () => {
    await expect(readEnvFile('/nonexistent/file.json')).rejects.toThrowError(
      expect.any(CliError),
    )
  })

  it('throws CliError for invalid JSON content', async () => {
    const root = await createTempRoot()
    const file = join(root, 'env.json')
    await writeFile(file, '{invalid')

    await expect(readEnvFile(file)).rejects.toThrowError(
      expect.any(CliError),
    )
  })
})

describe('createPresetCreateCommand', () => {
  it('returns the created preset ref for detected preset creation', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const claudeSettingsEnvService = {
      read: vi.fn().mockResolvedValue([
        {
          path: '/home/.claude/settings.json',
          exists: true,
          env: { ANTHROPIC_AUTH_TOKEN: 'token' },
        },
        { path: '/home/.claude/settings.local.json', exists: false, env: {} },
        { path: '/project/.claude/settings.json', exists: false, env: {} },
        { path: '/project/.claude/settings.local.json', exists: false, env: {} },
      ]),
      write: vi.fn().mockResolvedValue(undefined),
    }
    const historyService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn().mockResolvedValue({
      source: 'detected',
      env: { ANTHROPIC_AUTH_TOKEN: 'token' },
      selectedKeys: ['ANTHROPIC_AUTH_TOKEN'],
      presetName: 'claude-prod',
      destination: 'global',
    })

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      claudeSettingsEnvService,
      historyService,
      renderFlow,
    })

    await expect(createPreset({ cwd: '/project' })).resolves.toEqual({
      presetName: 'claude-prod',
      source: 'global',
    })
  })

  it('writes detected preset, records history, and removes only selected Claude settings keys', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const claudeSettingsEnvService = {
      read: vi.fn().mockResolvedValue([
        {
          path: '/home/.claude/settings.json',
          exists: true,
          env: {
            ANTHROPIC_BASE_URL: 'https://api.example.com',
            OPENAI_API_KEY: 'sk-openai',
          },
        },
        {
          path: '/home/.claude/settings.local.json',
          exists: true,
          env: {
            ANTHROPIC_AUTH_TOKEN: 'token',
          },
        },
        { path: '/project/.claude/settings.json', exists: false, env: {} },
        { path: '/project/.claude/settings.local.json', exists: false, env: {} },
      ]),
      write: vi.fn().mockResolvedValue(undefined),
    }
    const historyService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn().mockResolvedValue({
      source: 'detected',
      env: {
        ANTHROPIC_AUTH_TOKEN: 'token',
        ANTHROPIC_BASE_URL: 'https://api.example.com',
        OPENAI_API_KEY: 'sk-openai',
      },
      selectedKeys: ['ANTHROPIC_AUTH_TOKEN', 'OPENAI_API_KEY'],
      presetName: 'claude-prod',
      destination: 'global',
    })

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      claudeSettingsEnvService,
      historyService,
      renderFlow,
    })

    await createPreset({ cwd: '/project' })

    expect(renderFlow).toHaveBeenCalledWith({
      detectedEnv: {
        ANTHROPIC_AUTH_TOKEN: 'token',
        ANTHROPIC_BASE_URL: 'https://api.example.com',
        OPENAI_API_KEY: 'sk-openai',
      },
      requiredKeys: ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'],
    })
    expect(presetService.write).toHaveBeenCalledWith({
      name: 'claude-prod',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      env: {
        ANTHROPIC_AUTH_TOKEN: 'token',
        OPENAI_API_KEY: 'sk-openai',
      },
    })
    expect(historyService.write).toHaveBeenCalledWith({
      timestamp: expect.any(String),
      action: 'preset-create',
      projectPath: '/project',
      presetName: 'claude-prod',
      destination: 'global',
      migratedKeys: ['ANTHROPIC_AUTH_TOKEN', 'OPENAI_API_KEY'],
      sources: [
        {
          file: '/home/.claude/settings.json',
          backup: { OPENAI_API_KEY: 'sk-openai' },
        },
        {
          file: '/home/.claude/settings.local.json',
          backup: { ANTHROPIC_AUTH_TOKEN: 'token' },
        },
        {
          file: '/project/.claude/settings.json',
          backup: {},
        },
        {
          file: '/project/.claude/settings.local.json',
          backup: {},
        },
      ],
    })
    expect(claudeSettingsEnvService.write).toHaveBeenCalledWith([
      {
        path: '/home/.claude/settings.json',
        env: { ANTHROPIC_BASE_URL: 'https://api.example.com' },
      },
      {
        path: '/home/.claude/settings.local.json',
        env: {},
      },
      { path: '/project/.claude/settings.json', env: {} },
      { path: '/project/.claude/settings.local.json', env: {} },
    ])
  })

  it('records projectPath and only backs up the file that provided the effective detected value', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const claudeSettingsEnvService = {
      read: vi.fn().mockResolvedValue([
        {
          path: '/home/.claude/settings.json',
          exists: true,
          env: {
            SHARED_KEY: 'home',
            HOME_ONLY: '1',
          },
        },
        {
          path: '/home/.claude/settings.local.json',
          exists: true,
          env: {
            SHARED_KEY: 'local',
          },
        },
        {
          path: '/project/.claude/settings.json',
          exists: true,
          env: {},
        },
        {
          path: '/project/.claude/settings.local.json',
          exists: true,
          env: {
            PROJECT_ONLY: '2',
          },
        },
      ]),
      write: vi.fn().mockResolvedValue(undefined),
    }
    const historyService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn().mockResolvedValue({
      source: 'detected',
      env: { SHARED_KEY: 'local', PROJECT_ONLY: '2' },
      selectedKeys: ['PROJECT_ONLY', 'SHARED_KEY'],
      presetName: 'claude-prod',
      destination: 'global',
    })

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      claudeSettingsEnvService,
      historyService,
      renderFlow,
    })

    await createPreset({ cwd: '/project' })

    expect(historyService.write).toHaveBeenCalledWith({
      timestamp: expect.any(String),
      action: 'preset-create',
      projectPath: '/project',
      presetName: 'claude-prod',
      destination: 'global',
      migratedKeys: ['PROJECT_ONLY', 'SHARED_KEY'],
      sources: [
        {
          file: '/home/.claude/settings.json',
          backup: {},
        },
        {
          file: '/home/.claude/settings.local.json',
          backup: { SHARED_KEY: 'local' },
        },
        {
          file: '/project/.claude/settings.json',
          backup: {},
        },
        {
          file: '/project/.claude/settings.local.json',
          backup: { PROJECT_ONLY: '2' },
        },
      ],
    })
  })

  it('falls back to the normal flow when user rejects detected config env', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const claudeSettingsEnvService = {
      read: vi.fn().mockResolvedValue([
        { path: '/home/.claude/settings.json', exists: true, env: { OPENAI_API_KEY: 'sk-live' } },
        { path: '/home/.claude/settings.local.json', exists: false, env: {} },
        { path: '/project/.claude/settings.json', exists: false, env: {} },
        { path: '/project/.claude/settings.local.json', exists: false, env: {} },
      ]),
    }
    const renderFlow = vi.fn().mockResolvedValue({
      source: 'manual',
      env: { MANUAL_KEY: 'manual-value' },
      selectedKeys: ['MANUAL_KEY'],
      presetName: 'manual-preset',
      destination: 'project',
    })
    const ensureGitignore = vi.fn().mockResolvedValue(undefined)

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      claudeSettingsEnvService,
      renderFlow,
      ensureGitignore,
    })

    await createPreset({ cwd: '/project' })

    expect(renderFlow).toHaveBeenCalledWith({
      detectedEnv: { OPENAI_API_KEY: 'sk-live' },
      requiredKeys: [],
    })
    expect(projectEnvService.write).toHaveBeenCalledWith(
      { MANUAL_KEY: 'manual-value' },
      { name: 'manual-preset', createdAt: expect.any(String), updatedAt: expect.any(String) },
    )
    expect(ensureGitignore).toHaveBeenCalledWith('/project', '.cc-env')
  })

  it('writes to presetService when destination is global', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const ensureGitignore = vi.fn().mockResolvedValue(undefined)
    const renderFlow = vi.fn().mockResolvedValue({
      source: 'manual',
      env: { API_KEY: 'secret' },
      selectedKeys: ['API_KEY'],
      presetName: 'my-preset',
      destination: 'global',
    })

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow,
      ensureGitignore,
    })

    await createPreset({ cwd: '/project' })

    expect(presetService.write).toHaveBeenCalledWith({
      name: 'my-preset',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      env: { API_KEY: 'secret' },
    })
    expect(projectEnvService.write).not.toHaveBeenCalled()
    expect(ensureGitignore).not.toHaveBeenCalled()
  })

  it('writes to projectEnvService when destination is project', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const ensureGitignore = vi.fn().mockResolvedValue(undefined)
    const renderFlow = vi.fn().mockResolvedValue({
      source: 'file',
      filePath: '/path/to/env.json',
      env: { API_KEY: 'secret', OTHER: 'value' },
      selectedKeys: ['API_KEY'],
      presetName: 'proj',
      destination: 'project',
    })

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow,
      ensureGitignore,
    })

    await createPreset({ cwd: '/project' })

    expect(projectEnvService.write).toHaveBeenCalledWith({ API_KEY: 'secret' }, { name: 'proj', createdAt: expect.any(String), updatedAt: expect.any(String) })
    expect(presetService.write).not.toHaveBeenCalled()
  })

  it('calls ensureGitignore when destination is project', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const ensureGitignore = vi.fn().mockResolvedValue(undefined)
    const renderFlow = vi.fn().mockResolvedValue({
      source: 'manual',
      env: { KEY: 'val' },
      selectedKeys: ['KEY'],
      presetName: 'test',
      destination: 'project',
    })

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow,
      ensureGitignore,
    })

    await createPreset({ cwd: '/my-project' })

    expect(ensureGitignore).toHaveBeenCalledWith('/my-project', '.cc-env')
  })

  it('does not call ensureGitignore when destination is global', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const ensureGitignore = vi.fn().mockResolvedValue(undefined)
    const renderFlow = vi.fn().mockResolvedValue({
      source: 'manual',
      env: { KEY: 'val' },
      selectedKeys: ['KEY'],
      presetName: 'test',
      destination: 'global',
    })

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow,
      ensureGitignore,
    })

    await createPreset({ cwd: '/my-project' })

    expect(ensureGitignore).not.toHaveBeenCalled()
  })

  it('does not write history or mutate Claude settings when detected flow is cancelled', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const claudeSettingsEnvService = {
      read: vi.fn().mockResolvedValue([
        {
          path: '/home/.claude/settings.json',
          exists: true,
          env: { ANTHROPIC_AUTH_TOKEN: 'token' },
        },
        { path: '/home/.claude/settings.local.json', exists: false, env: {} },
        { path: '/project/.claude/settings.json', exists: false, env: {} },
        { path: '/project/.claude/settings.local.json', exists: false, env: {} },
      ]),
      write: vi.fn().mockResolvedValue(undefined),
    }
    const historyService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn().mockResolvedValue(undefined)

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      claudeSettingsEnvService,
      historyService,
      renderFlow,
    })

    await createPreset({ cwd: '/project' })

    expect(presetService.write).not.toHaveBeenCalled()
    expect(projectEnvService.write).not.toHaveBeenCalled()
    expect(historyService.write).not.toHaveBeenCalled()
    expect(claudeSettingsEnvService.write).not.toHaveBeenCalled()
  })

  it('does nothing when renderFlow returns undefined', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn().mockResolvedValue(undefined)

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow,
    })

    await createPreset({ cwd: '/project' })

    expect(presetService.write).not.toHaveBeenCalled()
    expect(projectEnvService.write).not.toHaveBeenCalled()
  })

  it('only includes selected keys in the written env', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn().mockResolvedValue({
      source: 'file',
      filePath: '/env.json',
      env: { A: '1', B: '2', C: '3' },
      selectedKeys: ['A', 'C'],
      presetName: 'partial',
      destination: 'global',
    })

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow,
    })

    await createPreset({ cwd: '/project' })

    expect(presetService.write).toHaveBeenCalledWith({
      name: 'partial',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      env: { A: '1', C: '3' },
    })
  })
})
