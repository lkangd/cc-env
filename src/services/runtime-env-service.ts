import { envMapSchema, type EnvMap } from '../core/schema.js'

export function createRuntimeEnvService() {
  return {
    merge({
      processEnv,
      settingsEnv,
      projectEnv,
      presetEnv,
    }: {
      processEnv: EnvMap
      settingsEnv: EnvMap
      projectEnv: EnvMap
      presetEnv: EnvMap
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
