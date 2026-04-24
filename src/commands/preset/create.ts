import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

import { parse as parseYaml } from 'yaml'

import { CliError } from '../../core/errors.js'
import type { EnvMap } from '../../core/schema.js'
import { toProcessEnvMap } from '../../core/process-env.js'
import type { PresetCreateAppResult } from '../../ink/preset-create-app.js'

type PresetService = {
  write: (name: string, env: EnvMap) => Promise<unknown>
}

type ProjectEnvService = {
  write: (env: EnvMap) => Promise<unknown>
}

type CreatePresetOptions = {
  name?: string
  file?: string
  pairs?: string[]
  project?: boolean
}

type RenderFlowContext = Required<Pick<CreatePresetOptions, 'pairs' | 'project'>>
  & Pick<CreatePresetOptions, 'name' | 'file'>

type CreatePresetCreateCommandOptions = {
  presetService: PresetService
  projectEnvService: ProjectEnvService
  renderFlow: (context: RenderFlowContext) => Promise<PresetCreateAppResult | void> | PresetCreateAppResult | void
}

export function parseInlinePairs(pairs: string[]): EnvMap {
  return toProcessEnvMap(
    Object.fromEntries(
      pairs.map((pair) => {
        const separatorIndex = pair.indexOf('=')

        if (separatorIndex <= 0) {
          throw new CliError(`Invalid env pair: ${pair}`, 2)
        }

        return [pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1)]
      }),
    ),
  )
}

async function readEnvFile(filePath: string): Promise<EnvMap> {
  try {
    const content = await readFile(filePath, 'utf8')
    const extension = extname(filePath).toLowerCase()
    const parsed = extension === '.yaml' || extension === '.yml'
      ? parseYaml(content)
      : JSON.parse(content)

    return toProcessEnvMap((parsed ?? {}) as Record<string, unknown>)
  } catch {
    throw new CliError(`Failed to read env file: ${filePath}`, 2)
  }
}

export function createPresetCreateCommand({
  presetService,
  projectEnvService,
  renderFlow,
}: CreatePresetCreateCommandOptions) {
  return async function createPreset({
    name,
    file,
    pairs = [],
    project = false,
  }: CreatePresetOptions): Promise<void> {
    const context: RenderFlowContext = {
      name,
      file,
      pairs,
      project,
    }

    if (!file && pairs.length === 0) {
      const result = await renderFlow(context)
      const env = {
        ANTHROPIC_BASE_URL: 'https://api.openai.com',
      } satisfies EnvMap

      if (result?.destination === 'project') {
        await projectEnvService.write(env)
        return
      }

      if (result?.destination === 'preset') {
        await presetService.write('openai', env)
      }

      return
    }

    const env = file ? await readEnvFile(file) : parseInlinePairs(pairs)

    if (project) {
      await projectEnvService.write(env)
      return
    }

    if (!name) {
      throw new CliError('Preset name is required', 2)
    }

    await presetService.write(name, env)
  }
}
