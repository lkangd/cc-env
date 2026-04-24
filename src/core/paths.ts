import { join } from 'node:path'

export function resolveGlobalRoot(globalRoot?: string): string {
  return globalRoot ?? join(process.env.HOME ?? process.cwd(), '.cc-env')
}

export function resolveConfigPath(globalRoot: string): string {
  return join(globalRoot, 'config.json')
}

export function resolvePresetPath(globalRoot: string, name: string): string {
  return join(globalRoot, 'presets', `${name}.json`)
}

export function resolveHistoryPath(globalRoot: string, timestamp: string): string {
  return join(globalRoot, 'history', `${timestamp.replaceAll(':', '-')}.json`)
}

export function resolveLogPath(globalRoot: string): string {
  return join(globalRoot, 'logs', 'app.log')
}
