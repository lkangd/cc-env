import { describe, expect, it } from 'vitest'

import { maskValue, isSensitiveKey } from '../../src/core/mask.js'
import { envMapSchema, historySchema, presetSchema } from '../../src/core/schema.js'

describe('envMapSchema', () => {
  it('accepts uppercase flat string maps', () => {
    const result = envMapSchema.parse({
      API_URL: 'https://example.com',
      PORT: '3000',
      FEATURE_FLAG_1: 'enabled',
    })

    expect(result).toEqual({
      API_URL: 'https://example.com',
      PORT: '3000',
      FEATURE_FLAG_1: 'enabled',
    })
  })

  it('rejects nested values', () => {
    expect(() => envMapSchema.parse({ NESTED: { NOPE: 'x' } })).toThrow()
  })

  it('accepts non-object values by stringifying them', () => {
    const result = envMapSchema.parse({
      PORT: 3000,
      ENABLED: true,
      EMPTY: null,
    })

    expect(result).toEqual({
      PORT: '3000',
      ENABLED: 'true',
      EMPTY: 'null',
    })
  })

  it('rejects lowercase keys', () => {
    expect(() => envMapSchema.parse({ api_url: 'https://example.com' })).toThrow()
  })
})

describe('sensitive masking', () => {
  it('returns true for ANTHROPIC_AUTH_TOKEN', () => {
    expect(isSensitiveKey('ANTHROPIC_AUTH_TOKEN')).toBe(true)
  })

  it('returns true for mixed-case sensitive suffixes', () => {
    expect(isSensitiveKey('Anthropic_Auth_Token')).toBe(true)
  })

  it('masks sensitive values', () => {
    expect(maskValue('ANTHROPIC_AUTH_TOKEN', 'sk-1234567890')).toBe('sk-123456********')
  })

  it('masks short sensitive values without exposing the original secret', () => {
    expect(maskValue('ANTHROPIC_AUTH_TOKEN', 'short')).toBe('*****')
    expect(maskValue('ANTHROPIC_AUTH_TOKEN', '12345678')).toBe('********')
  })

  it('leaves non-sensitive values unchanged', () => {
    expect(maskValue('API_URL', 'https://example.com')).toBe('https://example.com')
  })
})

describe('historySchema', () => {
  it('accepts init history with per-file backups and shell writes', () => {
    const result = historySchema.parse({
      timestamp: '2026-04-24T12:00:00.000Z',
      action: 'init',
      migratedKeys: ['ANTHROPIC_AUTH_TOKEN'],
      settingsBackup: {
        ANTHROPIC_BASE_URL: 'https://settings.example.com',
      },
      settingsLocalBackup: {
        ANTHROPIC_AUTH_TOKEN: 'local-token',
      },
      shellWrites: [
        {
          shell: 'zsh',
          filePath: '/Users/test/.zshrc',
          env: {
            ANTHROPIC_AUTH_TOKEN: 'local-token',
          },
        },
      ],
    })

    expect(result).toEqual({
      timestamp: '2026-04-24T12:00:00.000Z',
      action: 'init',
      migratedKeys: ['ANTHROPIC_AUTH_TOKEN'],
      settingsBackup: {
        ANTHROPIC_BASE_URL: 'https://settings.example.com',
      },
      settingsLocalBackup: {
        ANTHROPIC_AUTH_TOKEN: 'local-token',
      },
      shellWrites: [
        {
          shell: 'zsh',
          filePath: '/Users/test/.zshrc',
          env: {
            ANTHROPIC_AUTH_TOKEN: 'local-token',
          },
        },
      ],
    })
  })

  it('rejects init history without migratedKeys', () => {
    expect(() =>
      historySchema.parse({
        timestamp: '2026-04-24T12:00:00.000Z',
        action: 'init',
        settingsBackup: {},
        settingsLocalBackup: {
          ANTHROPIC_AUTH_TOKEN: 'local-token',
        },
        shellWrites: [],
      }),
    ).toThrow()
  })
})

describe('presetSchema', () => {
  it('validates a preset object with name, createdAt, updatedAt, and env', () => {
    const result = presetSchema.parse({
      name: 'default',
      createdAt: '2026-04-24T12:00:00.000Z',
      updatedAt: '2026-04-24T12:30:00.000Z',
      env: {
        API_URL: 'https://example.com',
        ANTHROPIC_AUTH_TOKEN: 'sk-1234567890',
      },
    })

    expect(result).toEqual({
      name: 'default',
      createdAt: '2026-04-24T12:00:00.000Z',
      updatedAt: '2026-04-24T12:30:00.000Z',
      env: {
        API_URL: 'https://example.com',
        ANTHROPIC_AUTH_TOKEN: 'sk-1234567890',
      },
    })
  })

  it('rejects invalid ISO datetimes for createdAt and updatedAt', () => {
    expect(() =>
      presetSchema.parse({
        name: 'default',
        createdAt: 'not-a-date',
        updatedAt: '2026-04-24',
        env: {
          API_URL: 'https://example.com',
        },
      }),
    ).toThrow()
  })
})
