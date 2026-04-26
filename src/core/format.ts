import { maskValue } from './mask.js'
import type { EnvMap } from './schema.js'

export function formatEnvBlock(env: EnvMap): string {
  return Object.entries(env)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${maskValue(key, value)}`)
    .join('\n')
}

export function formatRestorePreview(env: EnvMap): string {
  return Object.entries(env)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}
