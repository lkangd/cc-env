import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { CliError } from '../../src/core/errors.js'
import { createProjectEnvService } from '../../src/services/project-env-service.js'
import { createRuntimeEnvService } from '../../src/services/runtime-env-service.js'
import { createSettingsEnvService } from '../../src/services/settings-env-service.js'

const tempRoots: string[] = []

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'cc-env-runtime-'))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('settings env service', () => {
  it('loads env from settings.json env field', async () => {
    const root = await createTempRoot()
    const settingsPath = join(root, 'settings.json')

    await writeFile(
      settingsPath,
      `${JSON.stringify({ theme: 'dark', env: { OPENAI_API_KEY: 'sk-settings' } }, null, 2)}\n`,
      'utf8',
    )

    const service = createSettingsEnvService({ settingsPath })

    await expect(service.read()).resolves.toEqual({
      OPENAI_API_KEY: 'sk-settings',
    })
  })
})

describe('project env service', () => {
  it('throws when env.json and env.yaml both exist', async () => {
    const root = await createTempRoot()
    const envDir = join(root, '.cc-env')

    await mkdir(envDir, { recursive: true })
    await writeFile(join(envDir, 'env.json'), '{"OPENAI_API_KEY":"sk-json"}\n', 'utf8')
    await writeFile(join(envDir, 'env.yaml'), 'OPENAI_API_KEY: sk-yaml\n', 'utf8')

    const service = createProjectEnvService({ cwd: root })

    await expect(service.read()).rejects.toThrowError(
      new CliError('Project env conflict: env.json and env.yaml both exist'),
    )
  })

  it('creates env.json on first write when no project env file exists', async () => {
    const root = await createTempRoot()
    const service = createProjectEnvService({ cwd: root })

    await expect(service.write({ OPENAI_API_KEY: 'sk-first-write' })).resolves.toEqual({
      OPENAI_API_KEY: 'sk-first-write',
    })

    await expect(readFile(join(root, '.cc-env', 'env.json'), 'utf8')).resolves.toBe(
      '{\n  "OPENAI_API_KEY": "sk-first-write"\n}\n',
    )
  })
})

describe('runtime env service', () => {
  it('merges env in process < settings < project < preset order', () => {
    const service = createRuntimeEnvService()

    expect(
      service.merge({
        settingsEnv: {
          SHARED: 'settings',
          SETTINGS_ONLY: 'settings-only',
        },
        processEnv: {
          SHARED: 'process',
          PROCESS_ONLY: 'process-only',
        },
        presetEnv: {
          SHARED: 'preset',
          PRESET_ONLY: 'preset-only',
        },
        projectEnv: {
          SHARED: 'project',
          PROJECT_ONLY: 'project-only',
        },
      }),
    ).toEqual({
      SHARED: 'preset',
      SETTINGS_ONLY: 'settings-only',
      PROCESS_ONLY: 'process-only',
      PRESET_ONLY: 'preset-only',
      PROJECT_ONLY: 'project-only',
    })
  })
})
