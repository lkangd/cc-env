import { describe, expect, it } from 'vitest'

import {
  resolveClaudeSettingsLocalPath,
  resolveClaudeSettingsPath,
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
})
