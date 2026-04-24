import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { CliError } from '../../src/core/errors.js'
import { createConfigService } from '../../src/services/config-service.js'
import { createHistoryService } from '../../src/services/history-service.js'
import { createPresetService } from '../../src/services/preset-service.js'

const tempRoots: string[] = []

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'cc-env-storage-'))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('config service', () => {
  it('reads and writes defaultPreset', async () => {
    const globalRoot = await createTempRoot()
    const service = createConfigService(globalRoot)

    await service.write({ defaultPreset: 'openai' })

    await expect(service.read()).resolves.toEqual({ defaultPreset: 'openai' })
  })
})

describe('preset service', () => {
  it('writes, reads, lists names, removes, and throws when preset is missing', async () => {
    const globalRoot = await createTempRoot()
    const service = createPresetService(globalRoot)

    await expect(
      service.write({
        name: 'openai',
        createdAt: '2026-04-24T12:00:00.000Z',
        updatedAt: '2026-04-24T12:00:00.000Z',
        env: {
          OPENAI_API_KEY: 'sk-123',
        },
      }),
    ).resolves.toMatchObject({
      name: 'openai',
      filePath: expect.stringContaining('presets/openai.json'),
    })

    await expect(service.read('openai')).resolves.toMatchObject({
      name: 'openai',
      filePath: expect.stringContaining('presets/openai.json'),
    })
    await expect(service.listNames()).resolves.toEqual(['openai'])

    await service.remove('openai')

    await expect(service.listNames()).resolves.toEqual([])
    await expect(service.read('openai')).rejects.toThrowError(new CliError('Preset not found: openai'))
  })
})

describe('history service', () => {
  it('writes records and lists them with targetName preserved', async () => {
    const globalRoot = await createTempRoot()
    const service = createHistoryService(globalRoot)

    await service.write({
      action: 'restore',
      targetType: 'preset',
      targetName: 'openai',
      timestamp: '2026-04-24T12:34:56.000Z',
    })

    await expect(service.list()).resolves.toEqual([
      {
        action: 'restore',
        targetType: 'preset',
        targetName: 'openai',
        timestamp: '2026-04-24T12:34:56.000Z',
      },
    ])
  })
})
