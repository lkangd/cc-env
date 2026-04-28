import { describe, expect, it } from 'vitest'

import { formatEnvBlock, formatRestorePreview, formatRunEnvBlock } from '../../src/core/format.js'

describe('format helpers', () => {
  it('formatEnvBlock sorts keys and masks secrets', () => {
    const out = formatEnvBlock({ B: '2', A: '1', API_KEY: 'abcdef123456789' })
    expect(out).toContain('A=1')
    expect(out).toContain('B=2')
    expect(out).toContain('API_KEY=abcdef123********')
  })

  it('formatRunEnvBlock includes preset keys and other count', () => {
    const out = formatRunEnvBlock({ A: '1', B: '2', C: '3' }, new Set(['A', 'C']))
    expect(out).toContain('A=1')
    expect(out).toContain('C=3')
    expect(out).toContain('+1 other env vars applied')
  })

  it('formatRunEnvBlock omits other count when no extra vars', () => {
    const out = formatRunEnvBlock({ A: '1' }, new Set(['A']))
    expect(out).toBe('A=1')
  })

  it('formatRestorePreview keeps raw values and sorted order', () => {
    const out = formatRestorePreview({ B: '2', A: '1' })
    expect(out).toBe('A=1\nB=2')
  })
})
