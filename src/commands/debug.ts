import { toProcessEnvMap } from '../core/process-env.js'
import { renderEnvSummary } from '../ink/summary.js'
import type { EnvMap } from '../core/schema.js'

type EnvReader = {
  read: () => Promise<EnvMap>
}

type RuntimeEnvService = {
  merge: (input: {
    processEnv: EnvMap
    settingsEnv: EnvMap
    projectEnv: EnvMap
    presetEnv: EnvMap
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
      processEnv: toProcessEnvMap(processEnv),
      settingsEnv,
      projectEnv,
      presetEnv,
    })

    await renderEnvSummary({
      title: 'Merged Environment',
      description: 'Final env after merging: process + settings + project + preset',
      env: mergedEnv,
    })
  }
}
