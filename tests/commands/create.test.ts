import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi, afterEach } from 'vitest'

import { createPresetCreateCommand } from '../../src/commands/preset/create.js'
import { CliError } from '../../src/core/errors.js'
import { toProcessEnvMap } from '../../src/core/process-env.js'

describe('toProcessEnvMap', () => {
  it('filters process.env-like input to string values only', () => {
    expect(
      toProcessEnvMap({
        ANTHROPIC_BASE_URL: 'https://api.openai.com',
        EMPTY: undefined,
        PORT: 3000,
        ENABLED: true,
      }),
    ).toEqual({
      ANTHROPIC_BASE_URL: 'https://api.openai.com',
    })
  })
})

const tempRoots: string[] = []

async function createTempRoot() {
  const root = await mkdtemp(join(tmpdir(), 'cc-env-create-'))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('createPresetCreateCommand', () => {
  it('creates a preset from inline KEY=VALUE pairs', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn()

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow,
    })

    await createPreset({
      name: 'openai',
      pairs: ['ANTHROPIC_BASE_URL=https://api.openai.com'],
    })

    expect(presetService.write).toHaveBeenCalledWith('openai', {
      ANTHROPIC_BASE_URL: 'https://api.openai.com',
    })
    expect(projectEnvService.write).not.toHaveBeenCalled()
    expect(renderFlow).not.toHaveBeenCalled()
  })

  it('throws a CliError for invalid inline env pairs', async () => {
    const createPreset = createPresetCreateCommand({
      presetService: { write: vi.fn().mockResolvedValue(undefined) },
      projectEnvService: { write: vi.fn().mockResolvedValue(undefined) },
      renderFlow: vi.fn(),
    })

    await expect(
      createPreset({
        name: 'openai',
        pairs: ['ANTHROPIC_BASE_URL'],
      }),
    ).rejects.toThrowError(new CliError('Invalid env pair: ANTHROPIC_BASE_URL', 2))
  })

  it('throws a CliError when preset target is missing a name', async () => {
    const createPreset = createPresetCreateCommand({
      presetService: { write: vi.fn().mockResolvedValue(undefined) },
      projectEnvService: { write: vi.fn().mockResolvedValue(undefined) },
      renderFlow: vi.fn(),
    })

    await expect(
      createPreset({
        pairs: ['ANTHROPIC_BASE_URL=https://api.openai.com'],
      }),
    ).rejects.toThrowError(new CliError('Preset name is required', 2))
  })

  it('wraps invalid file input in a CliError', async () => {
    const root = await createTempRoot()
    const file = join(root, 'env.json')
    await writeFile(file, '{invalid', 'utf8')

    const createPreset = createPresetCreateCommand({
      presetService: { write: vi.fn().mockResolvedValue(undefined) },
      projectEnvService: { write: vi.fn().mockResolvedValue(undefined) },
      renderFlow: vi.fn(),
    })

    await expect(
      createPreset({
        name: 'openai',
        file,
      }),
    ).rejects.toThrowError(new CliError(`Failed to read env file: ${file}`, 2))
  })

  it('calls interactive fallback with context when no file or pairs are provided', async () => {
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

    await createPreset({
      name: 'openai',
      project: true,
    })

    expect(renderFlow).toHaveBeenCalledWith({
      name: 'openai',
      file: undefined,
      pairs: [],
      project: true,
    })
    expect(presetService.write).not.toHaveBeenCalled()
    expect(projectEnvService.write).not.toHaveBeenCalled()
  })
})
