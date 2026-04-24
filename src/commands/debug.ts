import { formatEnvBlock } from '../core/format.js'
import { toProcessEnvMap } from '../core/process-env.js'
import type { EnvMap } from '../core/schema.js'

type EnvReader = {
  read: () => Promise<EnvMap>
}

type RuntimeEnvService = {
  merge: (input: {
    settingsEnv: EnvMap
    processEnv: EnvMap
    presetEnv: EnvMap
    projectEnv: EnvMap
  }) => EnvMap
}

export function createDebugCommand({
  settingsEnvService,
  projectEnvService,
  runtimeEnvService,
  processEnv,
  presetEnv = {},
}: {
  settingsEnvService: EnvReader
  projectEnvService: EnvReader
  runtimeEnvService: RuntimeEnvService
  processEnv: Record<string, unknown>
  presetEnv?: EnvMap
}) {
  return async function debug(): Promise<void> {
    const [settingsEnv, projectEnv] = await Promise.all([
      settingsEnvService.read(),
      projectEnvService.read(),
    ])

    const mergedEnv = runtimeEnvService.merge({
      settingsEnv,
      processEnv: toProcessEnvMap(processEnv),
      presetEnv,
      projectEnv,
    })

    console.log(formatEnvBlock(mergedEnv))
  }
}
