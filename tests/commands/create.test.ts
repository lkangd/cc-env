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
  it('writes to presetService when destination is global', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
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
    })

    await createPreset()

    expect(presetService.write).toHaveBeenCalledWith({
      name: 'my-preset',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      env: { API_KEY: 'secret' },
    })
    expect(projectEnvService.write).not.toHaveBeenCalled()
  })

  it('writes to projectEnvService when destination is project', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
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
    })

    await createPreset()

    expect(projectEnvService.write).toHaveBeenCalledWith({ API_KEY: 'secret' })
    expect(presetService.write).not.toHaveBeenCalled()
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

    await createPreset()

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

    await createPreset()

    expect(presetService.write).toHaveBeenCalledWith({
      name: 'partial',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      env: { A: '1', C: '3' },
    })
  })
})
