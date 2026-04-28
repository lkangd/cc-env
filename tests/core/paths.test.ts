import { describe, expect, it } from 'vitest'

import {
  resolveClaudeSettingsLocalPath,
  resolveClaudeSettingsPath,
  resolveHistoryPath,
  resolveLogPath,
  resolvePresetPath,
  resolveShellConfigPaths,
} from '../../src/core/paths.js'

describe('Claude home path helpers', () => {
  it('resolves both Claude settings files under the given home directory', () => {
    expect(resolveClaudeSettingsPath('/Users/test')).toBe('/Users/test/.claude/settings.json')
    expect(resolveClaudeSettingsLocalPath('/Users/test')).toBe(
      '/Users/test/.claude/settings.local.json',
    )
  })

  it('resolves zsh, bash, and fish config targets', () => {
    expect(resolveShellConfigPaths('/Users/test')).toEqual({
      zsh: '/Users/test/.zshrc',
      bash: '/Users/test/.bashrc',
      fish: '/Users/test/.config/fish/config.fish',
    })
  })

  it('resolves log, history, and preset paths under global root', () => {
    expect(resolveLogPath('/tmp/cc-env')).toBe('/tmp/cc-env/logs/app.log')
    expect(resolvePresetPath('/tmp/cc-env', 'openai')).toBe('/tmp/cc-env/presets/openai.json')
    expect(resolveHistoryPath('/tmp/cc-env', '2026-04-28T14:30:00.000Z')).toBe(
      '/tmp/cc-env/history/2026-04-28T14-30-00.000Z.json',
    )
  })
})
