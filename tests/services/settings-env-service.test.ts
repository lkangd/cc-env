import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { createSettingsEnvService } from '../../src/services/settings-env-service.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('settings env service', () => {
  it('read returns empty env when settings file is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cc-env-settings-'))
    roots.push(root)

    const service = createSettingsEnvService({ settingsPath: join(root, 'settings.json') })
    await expect(service.read()).resolves.toEqual({})
  })

  it('read parses env from existing settings file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cc-env-settings-'))
    roots.push(root)
    const settingsPath = join(root, 'settings.json')

    await writeFile(settingsPath, '{"env":{"API_KEY":"k1"},"theme":"dark"}\n', 'utf8')

    const service = createSettingsEnvService({ settingsPath })
    await expect(service.read()).resolves.toEqual({ API_KEY: 'k1' })
  })

  it('write preserves sibling fields and updates env', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cc-env-settings-'))
    roots.push(root)
    const settingsPath = join(root, 'settings.json')

    await writeFile(settingsPath, '{"theme":"dark","env":{"OLD":"1"}}\n', 'utf8')

    const service = createSettingsEnvService({ settingsPath })
    await service.write({ NEW: '2' })

    const content = await readFile(settingsPath, 'utf8')
    expect(content).toContain('"theme": "dark"')
    expect(content).toContain('"NEW": "2"')
    expect(content).not.toContain('"OLD": "1"')
  })

  it('write creates file when it does not exist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cc-env-settings-'))
    roots.push(root)
    const dir = join(root, '.claude')
    await mkdir(dir, { recursive: true })
    const settingsPath = join(dir, 'settings.json')

    const service = createSettingsEnvService({ settingsPath })
    await service.write({ CREATED: 'yes' })

    const content = await readFile(settingsPath, 'utf8')
    expect(content).toContain('"CREATED": "yes"')
  })
})
