import { access, mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { atomicWriteFile } from '../../src/core/fs.js'
import { CliError } from '../../src/core/errors.js'
import type { HistoryRecord } from '../../src/core/schema.js'
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

  it('returns empty list when preset directory is missing and remove is no-op', async () => {
    const globalRoot = await createTempRoot()
    const service = createPresetService(globalRoot)

    await expect(service.listNames()).resolves.toEqual([])
    await expect(service.remove('missing')).resolves.toBeUndefined()
  })

  it('throws parse error when preset file contains invalid JSON', async () => {
    const globalRoot = await createTempRoot()
    const service = createPresetService(globalRoot)
    const presetPath = service.getPath('broken')

    await mkdir(dirname(presetPath), { recursive: true })
    await writeFile(presetPath, '{not-json}\n', 'utf8')

    await expect(service.read('broken')).rejects.toThrow()
  })
})

describe('history service', () => {
  it('returns empty list when history directory is missing', async () => {
    const globalRoot = await createTempRoot()
    const service = createHistoryService(globalRoot)

    await expect(service.list()).resolves.toEqual([])
  })

  it('writes restore records and lists them with targetName preserved', async () => {
    const globalRoot = await createTempRoot()
    const service = createHistoryService(globalRoot)

    await service.write({
      action: 'restore',
      targetType: 'preset',
      targetName: 'openai',
      timestamp: '2026-04-24T12:34:56.000Z',
      backup: {
        OPENAI_API_KEY: 'sk-123',
      },
    })

    await expect(service.list()).resolves.toEqual([
      {
        action: 'restore',
        targetType: 'preset',
        targetName: 'openai',
        timestamp: '2026-04-24T12:34:56.000Z',
        backup: {
          OPENAI_API_KEY: 'sk-123',
        },
      },
    ])
  })

  it('lists history records in descending timestamp order', async () => {
    const globalRoot = await createTempRoot()
    const service = createHistoryService(globalRoot)

    await service.write({
      action: 'restore',
      targetType: 'preset',
      targetName: 'a',
      timestamp: '2026-04-24T08:00:00.000Z',
      backup: { A: '1' },
    })
    await service.write({
      action: 'restore',
      targetType: 'preset',
      targetName: 'b',
      timestamp: '2026-04-24T09:00:00.000Z',
      backup: { B: '2' },
    })

    const records = await service.list()
    expect(records.map((r) => r.timestamp)).toEqual([
      '2026-04-24T09:00:00.000Z',
      '2026-04-24T08:00:00.000Z',
    ])
  })

  it('persists expanded init history records', async () => {
    const globalRoot = await createTempRoot()
    const service = createHistoryService(globalRoot)

    const record: HistoryRecord = {
      timestamp: '2026-04-24T10:00:00.000Z',
      action: 'init',
      migratedKeys: ['ANTHROPIC_AUTH_TOKEN'],
      sources: [
        {
          file: '/Users/test/.claude/settings.json',
          backup: {},
        },
        {
          file: '/Users/test/.claude/settings.local.json',
          backup: {
            ANTHROPIC_AUTH_TOKEN: 'local-token',
          },
        },
      ],
      shellWrites: [
        {
          shell: 'fish',
          filePath: '/Users/test/.config/fish/config.fish',
          env: {
            ANTHROPIC_AUTH_TOKEN: 'local-token',
          },
        },
      ],
    }

    await expect(service.write(record)).resolves.toEqual(record)
    await expect(service.list()).resolves.toMatchObject([
      {
        action: 'init',
        shellWrites: [
          {
            shell: 'fish',
          },
        ],
      },
    ])
  })
})
