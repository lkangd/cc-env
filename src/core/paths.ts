import { join } from 'node:path'

export function resolveGlobalRoot(globalRoot?: string): string {
  return globalRoot ?? join(process.env.HOME ?? process.cwd(), '.cc-env')
}

export function resolveClaudeSettingsPath(homeDir = process.env.HOME ?? process.cwd()): string {
  return join(homeDir, '.claude', 'settings.json')
}

export function resolveClaudeSettingsLocalPath(homeDir = process.env.HOME ?? process.cwd()): string {
  return join(homeDir, '.claude', 'settings.local.json')
}

export function resolveProjectSettingsPath(cwd = process.cwd()): string {
  return join(cwd, '.claude', 'settings.json')
}

export function resolveProjectSettingsLocalPath(cwd = process.cwd()): string {
  return join(cwd, '.claude', 'settings.local.json')
}

export function resolveShellConfigPaths(homeDir = process.env.HOME ?? process.cwd()) {
  return {
    zsh: join(homeDir, '.zshrc'),
    bash: join(homeDir, '.bashrc'),
    fish: join(homeDir, '.config', 'fish', 'config.fish'),
  }
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
