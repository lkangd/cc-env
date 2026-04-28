import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { createProjectStateService } from '../../src/services/project-state-service.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('project state service', () => {
  it('getLastPreset returns undefined when file is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cc-env-state-'))
    roots.push(root)

    const service = createProjectStateService(root)
    await expect(service.getLastPreset('/repo/a')).resolves.toBeUndefined()
  })

  it('saveLastPreset persists and getLastPreset reads it back', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cc-env-state-'))
    roots.push(root)

    const service = createProjectStateService(root)
    await service.saveLastPreset('/repo/a', { presetName: 'openai', source: 'global' })

    await expect(service.getLastPreset('/repo/a')).resolves.toEqual({
      presetName: 'openai',
      source: 'global',
    })
  })

  it('saveLastPreset updates one cwd without dropping others', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cc-env-state-'))
    roots.push(root)

    const service = createProjectStateService(root)
    await service.saveLastPreset('/repo/a', { presetName: 'openai', source: 'global' })
    await service.saveLastPreset('/repo/b', { presetName: 'project', source: 'project' })
    await service.saveLastPreset('/repo/a', { presetName: 'anthropic', source: 'global' })

    await expect(service.getLastPreset('/repo/a')).resolves.toEqual({
      presetName: 'anthropic',
      source: 'global',
    })
    await expect(service.getLastPreset('/repo/b')).resolves.toEqual({
      presetName: 'project',
      source: 'project',
    })

    const raw = await readFile(join(root, 'project-state.json'), 'utf8')
    expect(raw).toContain('/repo/a')
    expect(raw).toContain('/repo/b')
  })
})
