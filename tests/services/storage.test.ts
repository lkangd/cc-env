import { access, mkdtemp, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { atomicWriteFile } from '../../src/core/fs.js'
import { withFileLock } from '../../src/core/lock.js'
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

describe('atomicWriteFile', () => {
  it('replaces the target file without leaving temp files behind', async () => {
    const globalRoot = await createTempRoot()
    const filePath = join(globalRoot, 'config.json')

    await atomicWriteFile(filePath, '{"defaultPreset":"openai"}\n')

    await expect(access(filePath)).resolves.toBeUndefined()
    await expect(access(`${filePath}.tmp`)).rejects.toMatchObject({ code: 'ENOENT' })

    const entries = await readdir(dirname(filePath))
    expect(entries).toEqual(['config.json'])
  })
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

  it('removes a preset while holding the file lock', async () => {
    const globalRoot = await createTempRoot()
    const service = createPresetService(globalRoot)

    const stored = await service.write({
      name: 'openai',
      createdAt: '2026-04-24T12:00:00.000Z',
      updatedAt: '2026-04-24T12:00:00.000Z',
      env: {
        OPENAI_API_KEY: 'sk-123',
      },
    })

    let removal: Promise<void> | undefined

    await withFileLock(stored.filePath, async () => {
      removal = service.remove('openai')

      await expect(Promise.race([
        removal.then(() => 'removed'),
        new Promise((resolve) => setTimeout(() => resolve('waiting'), 25)),
      ])).resolves.toBe('waiting')
    })

    await expect(removal).resolves.toBeUndefined()
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
