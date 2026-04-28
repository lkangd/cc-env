import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { CliError } from '../../src/core/errors.js'
import { createProjectEnvService } from '../../src/services/project-env-service.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('project env service', () => {
  it('returns empty env when project env is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'cc-env-project-env-'))
    roots.push(cwd)

    const service = createProjectEnvService({ cwd })
    await expect(service.read()).resolves.toEqual({})
  })

  it('reads env from json file', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'cc-env-project-env-'))
    roots.push(cwd)

    const dir = join(cwd, '.cc-env')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'env.json'), '{"API_KEY":"json-key"}\n', 'utf8')

    const service = createProjectEnvService({ cwd })
    await expect(service.read()).resolves.toEqual({ API_KEY: 'json-key' })
  })

  it('reads env from yaml file', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'cc-env-project-env-'))
    roots.push(cwd)

    const dir = join(cwd, '.cc-env')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'env.yaml'), 'API_KEY: yaml-key\nBASE_URL: https://example.com\n', 'utf8')

    const service = createProjectEnvService({ cwd })
    await expect(service.read()).resolves.toEqual({
      API_KEY: 'yaml-key',
      BASE_URL: 'https://example.com',
    })
  })

  it('throws conflict error when json and yaml both exist', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'cc-env-project-env-'))
    roots.push(cwd)

    const dir = join(cwd, '.cc-env')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'env.json'), '{"A":"1"}\n', 'utf8')
    await writeFile(join(dir, 'env.yaml'), 'A: 1\n', 'utf8')

    const service = createProjectEnvService({ cwd })
    await expect(service.read()).rejects.toEqual(
      new CliError('Project env conflict: env.json and env.yaml both exist'),
    )
  })

  it('writes yaml when yaml mode is detected', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'cc-env-project-env-'))
    roots.push(cwd)

    const dir = join(cwd, '.cc-env')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'env.yaml'), 'OLD: old\n', 'utf8')

    const service = createProjectEnvService({ cwd })
    await service.write({ NEW: 'new' })

    const content = await readFile(join(dir, 'env.yaml'), 'utf8')
    expect(content).toContain('NEW: new')
    expect(content).not.toContain('OLD: old')
  })

  it('writes envelope with metadata into env.json', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'cc-env-project-env-'))
    roots.push(cwd)

    const service = createProjectEnvService({ cwd })
    await service.write(
      { API_KEY: 'value' },
      { name: 'project', createdAt: '2026-04-28T00:00:00.000Z', updatedAt: '2026-04-28T01:00:00.000Z' },
    )

    const content = await readFile(join(cwd, '.cc-env', 'env.json'), 'utf8')
    expect(content).toContain('"name": "project"')
    expect(content).toContain('"API_KEY": "value"')
    expect(content).toContain('"createdAt": "2026-04-28T00:00:00.000Z"')
  })
})
