import { envMapSchema, type EnvMap } from './schema.js'

export function toProcessEnvMap(input: Record<string, unknown>): EnvMap {
  return envMapSchema.parse(
    Object.fromEntries(
      Object.entries(input).filter(
        ([key, value]) => typeof value === 'string' && /^[A-Z0-9_]+$/.test(key),
      ),
    ),
  )
}
