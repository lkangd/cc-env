import { describe, expect, it } from 'vitest'

import { CliError, invalidUsage } from '../../src/core/errors.js'

describe('errors', () => {
  it('invalidUsage returns CliError with exitCode 2', () => {
    const err = invalidUsage('bad usage')
    expect(err).toBeInstanceOf(CliError)
    expect(err.message).toBe('bad usage')
    expect(err.exitCode).toBe(2)
  })
})
