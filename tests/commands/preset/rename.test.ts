import { describe, expect, it, vi } from 'vitest'

import { createRenamePresetCommand } from '../../../src/commands/preset/rename.js'
import { CliError } from '../../../src/core/errors.js'

describe('createRenamePresetCommand', () => {
  it('renames a preset successfully', async () => {
    const presetService = {
      read: vi.fn().mockResolvedValue({
        env: { API_KEY: 'secret' },
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      listNames: vi.fn().mockResolvedValue(['old-name']),
      write: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    }

    const chunks: string[] = []
    const originalStdout = process.stdout.write
    process.stdout.write = vi.fn((s: string) => { chunks.push(s); return true }) as typeof process.stdout.write

    const rename = createRenamePresetCommand({ presetService })
    await rename({ from: 'old-name', to: 'new-name' })

    expect(presetService.read).toHaveBeenCalledWith('old-name')
    expect(presetService.write).toHaveBeenCalledWith({
      name: 'new-name',
      env: { API_KEY: 'secret' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: expect.any(String),
    })
    expect(presetService.remove).toHaveBeenCalledWith('old-name')
    expect(chunks.join('')).toContain('Renamed preset "old-name" → "new-name"')

    process.stdout.write = originalStdout
  })

  it('throws when from name is missing', async () => {
    const presetService = {
      read: vi.fn(),
      listNames: vi.fn(),
      write: vi.fn(),
      remove: vi.fn(),
    }

    const rename = createRenamePresetCommand({ presetService })
    await expect(rename({ from: '', to: 'new' })).rejects.toThrow(CliError)
  })

  it('throws when to name is missing', async () => {
    const presetService = {
      read: vi.fn(),
      listNames: vi.fn(),
      write: vi.fn(),
      remove: vi.fn(),
    }

    const rename = createRenamePresetCommand({ presetService })
    await expect(rename({ from: 'old', to: '' })).rejects.toThrow(CliError)
  })

  it('throws when from and to names are the same', async () => {
    const presetService = {
      read: vi.fn(),
      listNames: vi.fn(),
      write: vi.fn(),
      remove: vi.fn(),
    }

    const rename = createRenamePresetCommand({ presetService })
    await expect(rename({ from: 'same', to: 'same' })).rejects.toThrow(
      new CliError('New name must be different from the current name')
    )
  })

  it('throws when target name already exists', async () => {
    const presetService = {
      read: vi.fn().mockResolvedValue({
        env: { API_KEY: 'secret' },
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      listNames: vi.fn().mockResolvedValue(['old-name', 'existing']),
      write: vi.fn(),
      remove: vi.fn(),
    }

    const rename = createRenamePresetCommand({ presetService })
    await expect(rename({ from: 'old-name', to: 'existing' })).rejects.toThrow(
      new CliError('Preset "existing" already exists')
    )
  })
})
