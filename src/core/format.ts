import { maskValue } from './mask.js'
import type { EnvMap } from './schema.js'

export function formatEnvBlock(env: EnvMap): string {
  return Object.entries(env)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${maskValue(key, value)}`)
    .join('\n')
}

export function formatRunEnvBlock(env: EnvMap, presetKeys: ReadonlySet<string>): string {
  const entries = Object.entries(env).sort(([a], [b]) => a.localeCompare(b))
  const presetEntries = entries.filter(([key]) => presetKeys.has(key))
  const otherCount = entries.length - presetEntries.length

  const lines = presetEntries.map(([key, value]) => `${key}=${maskValue(key, value)}`)
  if (otherCount > 0) {
    lines.push(`+${otherCount} other env vars applied`)
  }

  return lines.join('\n')
}

export function formatRestorePreview(env: EnvMap): string {
  return Object.entries(env)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}
