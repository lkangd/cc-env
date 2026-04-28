import { describe, expect, it } from 'vitest'

import { generateCompletion } from '../../src/commands/completion.js'

describe('generateCompletion', () => {
  it('generates bash completion script', () => {
    const output = generateCompletion('bash')

    expect(output).toContain('_cc_env_completions')
    expect(output).toContain('complete -F _cc_env_completions cc-env')
    expect(output).toContain('run init restore show delete create doctor completion')
  })

  it('generates zsh completion script', () => {
    const output = generateCompletion('zsh')

    expect(output).toContain('_cc_env')
    expect(output).toContain('compdef _cc_env cc-env')
    expect(output).toContain('run')
    expect(output).toContain('doctor')
  })

  it('generates fish completion script', () => {
    const output = generateCompletion('fish')

    expect(output).toContain('complete -c cc-env')
    expect(output).toContain("'run'")
    expect(output).toContain("'doctor'")
    expect(output).toContain("'completion'")
    expect(output).toContain('-l help')
    expect(output).toContain('-l version')
    expect(output).toContain('-l json')
  })

  it('defaults to bash for unknown shell types', () => {
    const output = generateCompletion('unknown')

    expect(output).toContain('_cc_env_completions')
    expect(output).toContain('bash completion')
  })
})
