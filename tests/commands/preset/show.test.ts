import { describe, expect, it, vi } from 'vitest'

import { createShowPresetsCommand } from '../../../src/commands/preset/show.js'

describe('show presets command', () => {
  it('prints message when no presets exist', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const showPresets = createShowPresetsCommand({
      presetService: {
        listNames: vi.fn().mockResolvedValue([]),
        read: vi.fn(),
      },
      projectEnvService: {
        readWithMeta: vi.fn().mockResolvedValue({ env: {} }),
      },
      renderShow: vi.fn(),
    })

    await showPresets()

    expect(logSpy).toHaveBeenCalledWith('No presets found.')
    logSpy.mockRestore()
  })

  it('shows project preset before global presets', async () => {
    const renderShow = vi.fn().mockResolvedValue(undefined)
    const showPresets = createShowPresetsCommand({
      presetService: {
        listNames: vi.fn().mockResolvedValue(['openai']),
        read: vi.fn().mockResolvedValue({ env: { OPENAI_API_KEY: 'sk-123' } }),
      },
      projectEnvService: {
        readWithMeta: vi.fn().mockResolvedValue({ env: { PROJECT_KEY: 'val' }, name: 'my-project' }),
      },
      renderShow,
    })

    await showPresets()

    expect(renderShow).toHaveBeenCalledWith([
      { name: 'my-project', env: { PROJECT_KEY: 'val' }, source: 'project' },
      { name: 'openai', env: { OPENAI_API_KEY: 'sk-123' }, source: 'global' },
    ])
  })

  it('uses "project" as fallback name when name is missing', async () => {
    const renderShow = vi.fn().mockResolvedValue(undefined)
    const showPresets = createShowPresetsCommand({
      presetService: {
        listNames: vi.fn().mockResolvedValue([]),
        read: vi.fn(),
      },
      projectEnvService: {
        readWithMeta: vi.fn().mockResolvedValue({ env: { KEY: 'val' } }),
      },
      renderShow,
    })

    await showPresets()

    expect(renderShow).toHaveBeenCalledWith([
      { name: 'project', env: { KEY: 'val' }, source: 'project' },
    ])
  })

  it('renders mixed project and global list', async () => {
    const renderShow = vi.fn().mockResolvedValue(undefined)
    const showPresets = createShowPresetsCommand({
      presetService: {
        listNames: vi.fn().mockResolvedValue(['openai', 'anthropic']),
        read: vi.fn()
          .mockResolvedValueOnce({ env: { OPENAI_API_KEY: 'sk-1' } })
          .mockResolvedValueOnce({ env: { ANTHROPIC_API_KEY: 'sk-2' } }),
      },
      projectEnvService: {
        readWithMeta: vi.fn().mockResolvedValue({ env: { PROJECT: 'yes' }, name: 'proj' }),
      },
      renderShow,
    })

    await showPresets()

    expect(renderShow).toHaveBeenCalledWith([
      { name: 'proj', env: { PROJECT: 'yes' }, source: 'project' },
      { name: 'openai', env: { OPENAI_API_KEY: 'sk-1' }, source: 'global' },
      { name: 'anthropic', env: { ANTHROPIC_API_KEY: 'sk-2' }, source: 'global' },
    ])
  })
})
