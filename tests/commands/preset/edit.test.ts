import { describe, expect, it, vi } from 'vitest'

import { createEditPresetCommand } from '../../../src/commands/preset/edit.js'
import { CliError } from '../../../src/core/errors.js'

describe('createEditPresetCommand', () => {
  it('updates a preset when user confirms', async () => {
    const presetService = {
      read: vi.fn().mockResolvedValue({
        env: { API_KEY: 'old-value' },
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      write: vi.fn().mockResolvedValue(undefined),
    }

    const renderEdit = vi.fn().mockResolvedValue({
      env: { API_KEY: 'new-value', NEW_KEY: 'added' },
      confirmed: true,
    })

    const chunks: string[] = []
    const originalStdout = process.stdout.write
    process.stdout.write = vi.fn((s: string) => { chunks.push(s); return true }) as typeof process.stdout.write

    const edit = createEditPresetCommand({ presetService, renderEdit })
    await edit({ name: 'my-preset' })

    expect(presetService.read).toHaveBeenCalledWith('my-preset')
    expect(renderEdit).toHaveBeenCalledWith({
      name: 'my-preset',
      env: { API_KEY: 'old-value' },
    })
    expect(presetService.write).toHaveBeenCalledWith({
      name: 'my-preset',
      env: { API_KEY: 'new-value', NEW_KEY: 'added' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: expect.any(String),
    })
    expect(chunks.join('')).toContain('Updated preset "my-preset"')

    process.stdout.write = originalStdout
  })

  it('does not update when user cancels', async () => {
    const presetService = {
      read: vi.fn().mockResolvedValue({
        env: { API_KEY: 'value' },
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      write: vi.fn(),
    }

    const renderEdit = vi.fn().mockResolvedValue({
      env: { API_KEY: 'changed' },
      confirmed: false,
    })

    const chunks: string[] = []
    const originalStdout = process.stdout.write
    process.stdout.write = vi.fn((s: string) => { chunks.push(s); return true }) as typeof process.stdout.write

    const edit = createEditPresetCommand({ presetService, renderEdit })
    await edit({ name: 'my-preset' })

    expect(presetService.write).not.toHaveBeenCalled()
    expect(chunks.join('')).toContain('Edit cancelled')

    process.stdout.write = originalStdout
  })

  it('does not update when renderEdit returns undefined', async () => {
    const presetService = {
      read: vi.fn().mockResolvedValue({
        env: { API_KEY: 'value' },
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      write: vi.fn(),
    }

    const renderEdit = vi.fn().mockResolvedValue(undefined)

    const chunks: string[] = []
    const originalStdout = process.stdout.write
    process.stdout.write = vi.fn((s: string) => { chunks.push(s); return true }) as typeof process.stdout.write

    const edit = createEditPresetCommand({ presetService, renderEdit })
    await edit({ name: 'my-preset' })

    expect(presetService.write).not.toHaveBeenCalled()
    expect(chunks.join('')).toContain('Edit cancelled')

    process.stdout.write = originalStdout
  })

  it('throws when name is missing', async () => {
    const presetService = {
      read: vi.fn(),
      write: vi.fn(),
    }

    const renderEdit = vi.fn()

    const edit = createEditPresetCommand({ presetService, renderEdit })
    await expect(edit({ name: '' })).rejects.toThrow(CliError)
  })
})
