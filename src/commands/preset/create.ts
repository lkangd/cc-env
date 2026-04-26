import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

import { parse as parseYaml } from 'yaml'

import { CliError } from '../../core/errors.js'
import { type EnvMap } from '../../core/schema.js'
import { toProcessEnvMap } from '../../core/process-env.js'
import type { PresetCreateAppResult } from '../../ink/preset-create-app.js'

type PresetService = {
  write: (preset: {
    name: string
    createdAt: string
    updatedAt: string
    env: EnvMap
  }) => Promise<unknown>
}

type ProjectEnvService = {
  write: (env: EnvMap) => Promise<unknown>
}

export async function readEnvFile(filePath: string): Promise<{ allKeys: string[]; env: EnvMap }> {
  try {
    const content = await readFile(filePath, 'utf8')
    const extension = extname(filePath).toLowerCase()

    if (extension !== '.yaml' && extension !== '.yml' && extension !== '.json') {
      throw new CliError(`Unsupported file format: ${extension}`, 2)
    }

    const parsed = extension === '.yaml' || extension === '.yml'
      ? parseYaml(content)
      : JSON.parse(content)

    const raw = (parsed ?? {}) as Record<string, unknown>
    const source = extension === '.json'
      && raw
      && typeof raw === 'object'
      && 'env' in raw
      && raw.env
      && typeof raw.env === 'object'
      && !Array.isArray(raw.env)
      ? raw.env as Record<string, unknown>
      : raw

    const env = toProcessEnvMap(source)
    return {
      allKeys: Object.keys(env),
      env,
    }
  } catch (error) {
    if (error instanceof CliError) throw error
    throw new CliError(`Failed to read env file: ${filePath}`, 2)
  }
}

export function createPresetCreateCommand({
  presetService,
  projectEnvService,
  renderFlow,
}: {
  presetService: PresetService
  projectEnvService: ProjectEnvService
  renderFlow: () => Promise<PresetCreateAppResult | void>
}) {
  return async function createPreset(): Promise<void> {
    const result = await renderFlow()

    if (!result) return

    const selectedEnv: EnvMap = {}
    for (const key of result.selectedKeys) {
      selectedEnv[key] = result.env[key] ?? ''
    }

    const timestamp = new Date().toISOString()

    if (result.destination === 'project') {
      await projectEnvService.write(selectedEnv)
      return
    }

    await presetService.write({
      name: result.presetName,
      createdAt: timestamp,
      updatedAt: timestamp,
      env: selectedEnv,
    })
  }
}
