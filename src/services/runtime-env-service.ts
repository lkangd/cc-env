import { envMapSchema, type EnvMap } from '../core/schema.js'

export function createRuntimeEnvService() {
  return {
    merge({
      settingsEnv,
      processEnv,
      presetEnv,
      projectEnv,
    }: {
      settingsEnv: EnvMap
      processEnv: EnvMap
      presetEnv: EnvMap
      projectEnv: EnvMap
    }): EnvMap {
      return envMapSchema.parse({
        ...processEnv,
        ...settingsEnv,
        ...projectEnv,
        ...presetEnv,
      })
    },
  }
}
