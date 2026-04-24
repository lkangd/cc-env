import { CliError } from '../core/errors.js'
import { formatEnvBlock } from '../core/format.js'
import type { EnvMap } from '../core/schema.js'

type ConfigService = {
  read: () => Promise<{ defaultPreset?: string }>
}

type PresetRecord = {
  env: EnvMap
}

type PresetService = {
  read: (name: string) => Promise<PresetRecord>
}

type RuntimeEnvService = {
  merge: (input: {
    settingsEnv: EnvMap
    processEnv: EnvMap
    presetEnv: EnvMap
    projectEnv: EnvMap
  }) => EnvMap
}

type EnvSources = (input: {
  preset: string
  presetEnv: EnvMap
}) => Promise<{
  settingsEnv: EnvMap
  processEnv: EnvMap
  presetEnv: EnvMap
  projectEnv: EnvMap
}>

type SpawnCommand = (
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv & EnvMap,
) => Promise<void>

export function createRunCommand({
  configService,
  presetService,
  envSources,
  runtimeEnvService,
  spawnCommand,
  stdout = process.stdout,
}: {
  configService: ConfigService
  presetService: PresetService
  envSources: EnvSources
  runtimeEnvService: RuntimeEnvService
  spawnCommand: SpawnCommand
  stdout?: Pick<NodeJS.WriteStream, 'write'>
}) {
  return async function run({
    preset,
    dryRun = false,
    command,
    args = [],
  }: {
    preset?: string
    dryRun?: boolean
    command: string
    args?: string[]
  }): Promise<void> {
    const config = await configService.read()
    const effectivePreset = preset ?? config.defaultPreset

    if (!effectivePreset) {
      throw new CliError('No preset selected')
    }

    const presetRecord = await presetService.read(effectivePreset)
    const mergedEnv = runtimeEnvService.merge(
      await envSources({
        preset: effectivePreset,
        presetEnv: presetRecord.env,
      }),
    )

    if (dryRun) {
      const envBlock = formatEnvBlock(mergedEnv)
      stdout.write(`Would run:\n${envBlock}\n\n${[command, ...args].join(' ')}\n`)
      return
    }

    await spawnCommand(command, args, {
      ...process.env,
      ...mergedEnv,
    })
  }
}
