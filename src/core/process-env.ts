import { envMapSchema, type EnvMap } from './schema.js'

export function toProcessEnvMap(input: Record<string, unknown>): EnvMap {
  return envMapSchema.parse(
    Object.fromEntries(
      Object.entries(input).filter(([, value]) => typeof value === 'string'),
    ),
  )
}
