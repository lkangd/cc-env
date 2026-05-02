import { describe, expect, it, vi } from 'vitest'

import { createShowPresetsCommand } from '../../../src/commands/preset/show.js'

type PresetShowItem = {
  name: string
  env: Record<string, string>
  source: 'global' | 'project'
}

type ShowActionResult =
  | { type: 'exit' }
  | { type: 'delete'; preset: PresetShowItem }
  | { type: 'edit'; preset: PresetShowItem; result: { env: Record<string, string>; confirmed: boolean } }
  | { type: 'rename'; preset: PresetShowItem; nextName: string; confirmed: boolean }
  | { type: 'open-directory'; preset: PresetShowItem }

function createPresetService() {
  return {
    listNames: vi.fn<() => Promise<string[]>>(),
    read: vi.fn<() => Promise<{ env: Record<string, string>; createdAt: string }>>(),
    write: vi.fn(),
    remove: vi.fn(),
    getPath: vi.fn<(name: string) => string>(),
  }
}

function createProjectEnvService() {
  return {
    readWithMeta: vi.fn<() => Promise<{ env: Record<string, string>; name?: string; createdAt?: string; updatedAt?: string }>>(),
    write: vi.fn(),
  }
}

describe('show presets command', () => {
  it('prints message when no presets exist', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const presetService = createPresetService()
    presetService.listNames.mockResolvedValue([])
    const projectEnvService = createProjectEnvService()
    projectEnvService.readWithMeta.mockResolvedValue({ env: {} })

    const showPresets = createShowPresetsCommand({
      presetService,
      projectEnvService,
      renderShow: vi.fn(),
      cwd: '/tmp/demo-project',
      openDirectory: vi.fn(),
    })

    await showPresets()

    expect(logSpy).toHaveBeenCalledWith('No presets found.')
    logSpy.mockRestore()
  })

  it('shows project preset before global presets', async () => {
    const presetService = createPresetService()
    presetService.listNames.mockResolvedValue(['openai'])
    presetService.read.mockResolvedValue({ env: { OPENAI_API_KEY: 'sk-123' }, createdAt: '2026-05-02T00:00:00.000Z' })
    const projectEnvService = createProjectEnvService()
    projectEnvService.readWithMeta.mockResolvedValue({ env: { PROJECT_KEY: 'val' }, name: 'my-project' })
    const renderShow = vi.fn().mockResolvedValue({ type: 'exit' } satisfies ShowActionResult)

    const showPresets = createShowPresetsCommand({
      presetService,
      projectEnvService,
      renderShow,
      cwd: '/tmp/demo-project',
      openDirectory: vi.fn(),
    })

    await showPresets()

    expect(renderShow).toHaveBeenCalledWith([
      { name: 'my-project', env: { PROJECT_KEY: 'val' }, source: 'project' },
      { name: 'openai', env: { OPENAI_API_KEY: 'sk-123' }, source: 'global' },
    ])
  })

  it('uses "project" as fallback name when name is missing', async () => {
    const presetService = createPresetService()
    presetService.listNames.mockResolvedValue([])
    const projectEnvService = createProjectEnvService()
    projectEnvService.readWithMeta.mockResolvedValue({ env: { KEY: 'val' } })
    const renderShow = vi.fn().mockResolvedValue({ type: 'exit' } satisfies ShowActionResult)

    const showPresets = createShowPresetsCommand({
      presetService,
      projectEnvService,
      renderShow,
      cwd: '/tmp/demo-project',
      openDirectory: vi.fn(),
    })

    await showPresets()

    expect(renderShow).toHaveBeenCalledWith([
      { name: 'project', env: { KEY: 'val' }, source: 'project' },
    ])
  })

  it('renders mixed project and global list', async () => {
    const presetService = createPresetService()
    presetService.listNames.mockResolvedValue(['openai', 'anthropic'])
    presetService.read
      .mockResolvedValueOnce({ env: { OPENAI_API_KEY: 'sk-1' }, createdAt: '2026-05-02T00:00:00.000Z' })
      .mockResolvedValueOnce({ env: { ANTHROPIC_API_KEY: 'sk-2' }, createdAt: '2026-05-02T00:00:00.000Z' })
    const projectEnvService = createProjectEnvService()
    projectEnvService.readWithMeta.mockResolvedValue({ env: { PROJECT: 'yes' }, name: 'proj' })
    const renderShow = vi.fn().mockResolvedValue({ type: 'exit' } satisfies ShowActionResult)

    const showPresets = createShowPresetsCommand({
      presetService,
      projectEnvService,
      renderShow,
      cwd: '/tmp/demo-project',
      openDirectory: vi.fn(),
    })

    await showPresets()

    expect(renderShow).toHaveBeenCalledWith([
      { name: 'proj', env: { PROJECT: 'yes' }, source: 'project' },
      { name: 'openai', env: { OPENAI_API_KEY: 'sk-1' }, source: 'global' },
      { name: 'anthropic', env: { ANTHROPIC_API_KEY: 'sk-2' }, source: 'global' },
    ])
  })

  it('opens the project preset directory and continues the show loop', async () => {
    const presetService = createPresetService()
    presetService.listNames.mockResolvedValue([])
    const projectEnvService = createProjectEnvService()
    projectEnvService.readWithMeta
      .mockResolvedValueOnce({ env: { PROJECT_KEY: '1' }, name: 'proj' })
      .mockResolvedValueOnce({ env: { PROJECT_KEY: '1' }, name: 'proj' })

    const openDirectory = vi.fn().mockResolvedValue(undefined)
    const renderShow = vi
      .fn<() => Promise<ShowActionResult>>()
      .mockResolvedValueOnce({ type: 'open-directory', preset: { name: 'proj', env: { PROJECT_KEY: '1' }, source: 'project' } })
      .mockResolvedValueOnce({ type: 'exit' })

    const showPresets = createShowPresetsCommand({
      presetService,
      projectEnvService,
      openDirectory,
      renderShow,
      cwd: '/tmp/demo-project',
    })

    await showPresets()

    expect(openDirectory).toHaveBeenCalledWith('/tmp/demo-project/.cc-env')
    expect(renderShow).toHaveBeenCalledTimes(2)
    expect(projectEnvService.write).not.toHaveBeenCalled()
    expect(presetService.write).not.toHaveBeenCalled()
    expect(presetService.remove).not.toHaveBeenCalled()
  })

  it('opens the containing directory for a global preset file', async () => {
    const presetService = createPresetService()
    presetService.listNames.mockResolvedValue(['openai'])
    presetService.read.mockResolvedValue({ env: { OPENAI_API_KEY: 'secret' }, createdAt: '2026-05-02T00:00:00.000Z' })
    presetService.getPath.mockReturnValue('/tmp/home/.cc-env/presets/openai.json')

    const projectEnvService = createProjectEnvService()
    projectEnvService.readWithMeta.mockResolvedValue({ env: {} })

    const openDirectory = vi.fn().mockResolvedValue(undefined)

    const showPresets = createShowPresetsCommand({
      presetService,
      projectEnvService,
      openDirectory,
      renderShow: vi
        .fn<() => Promise<ShowActionResult>>()
        .mockResolvedValueOnce({ type: 'open-directory', preset: { name: 'openai', env: { OPENAI_API_KEY: 'secret' }, source: 'global' } })
        .mockResolvedValueOnce({ type: 'exit' }),
      cwd: '/tmp/demo-project',
    })

    await showPresets()

    expect(openDirectory).toHaveBeenCalledWith('/tmp/home/.cc-env/presets')
    expect(presetService.write).not.toHaveBeenCalled()
    expect(presetService.remove).not.toHaveBeenCalled()
  })

  it('deletes the selected project preset and exits when the refreshed list is empty', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const presetService = createPresetService()
    presetService.listNames.mockResolvedValue([])
    const projectEnvService = createProjectEnvService()
    projectEnvService.readWithMeta
      .mockResolvedValueOnce({ env: { PROJECT_KEY: '1' }, name: 'proj', createdAt: '2026-05-02T00:00:00.000Z' })
      .mockResolvedValueOnce({ env: {} })

    const renderShow = vi
      .fn<() => Promise<ShowActionResult>>()
      .mockResolvedValueOnce({ type: 'delete', preset: { name: 'proj', env: { PROJECT_KEY: '1' }, source: 'project' } })

    const showPresets = createShowPresetsCommand({
      presetService,
      projectEnvService,
      renderShow,
      cwd: '/tmp/demo-project',
      openDirectory: vi.fn(),
    })

    await showPresets()

    expect(projectEnvService.write).toHaveBeenCalledWith({})
    expect(renderShow).toHaveBeenCalledTimes(1)
    expect(logSpy).toHaveBeenCalledWith('No presets found.')
    logSpy.mockRestore()
  })

  it('writes edited global env only when edit is confirmed', async () => {
    const presetService = createPresetService()
    presetService.listNames.mockResolvedValue(['openai'])
    presetService.read.mockResolvedValue({ env: { OPENAI_API_KEY: 'old' }, createdAt: '2026-05-02T00:00:00.000Z' })
    const projectEnvService = createProjectEnvService()
    projectEnvService.readWithMeta.mockResolvedValue({ env: {} })
    const renderShow = vi
      .fn<() => Promise<ShowActionResult>>()
      .mockResolvedValueOnce({
        type: 'edit',
        preset: { name: 'openai', env: { OPENAI_API_KEY: 'old' }, source: 'global' },
        result: { env: { OPENAI_API_KEY: 'new' }, confirmed: true },
      })
      .mockResolvedValueOnce({ type: 'exit' })

    const showPresets = createShowPresetsCommand({
      presetService,
      projectEnvService,
      renderShow,
      cwd: '/tmp/demo-project',
      openDirectory: vi.fn(),
    })

    await showPresets()

    expect(presetService.write).toHaveBeenCalledWith({
      name: 'openai',
      env: { OPENAI_API_KEY: 'new' },
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: expect.any(String),
    })
  })

  it('renames the selected project preset after confirmation', async () => {
    const presetService = createPresetService()
    presetService.listNames.mockResolvedValue([])
    const projectEnvService = createProjectEnvService()
    projectEnvService.readWithMeta
      .mockResolvedValueOnce({ env: { PROJECT_KEY: '1' }, name: 'proj', createdAt: '2026-05-02T00:00:00.000Z' })
      .mockResolvedValueOnce({ env: { PROJECT_KEY: '1' }, name: 'proj', createdAt: '2026-05-02T00:00:00.000Z' })
      .mockResolvedValueOnce({ env: { PROJECT_KEY: '1' }, name: 'proj', createdAt: '2026-05-02T00:00:00.000Z' })
      .mockResolvedValueOnce({ env: { PROJECT_KEY: '1' }, name: 'renamed', createdAt: '2026-05-02T00:00:00.000Z' })

    const renderShow = vi
      .fn<() => Promise<ShowActionResult>>()
      .mockResolvedValueOnce({
        type: 'rename',
        preset: { name: 'proj', env: { PROJECT_KEY: '1' }, source: 'project' },
        nextName: 'renamed',
        confirmed: true,
      })
      .mockResolvedValueOnce({ type: 'exit' })

    const showPresets = createShowPresetsCommand({
      presetService,
      projectEnvService,
      renderShow,
      cwd: '/tmp/demo-project',
      openDirectory: vi.fn(),
    })

    await showPresets()

    expect(projectEnvService.write).toHaveBeenCalledWith(
      { PROJECT_KEY: '1' },
      {
        name: 'renamed',
        createdAt: '2026-05-02T00:00:00.000Z',
        updatedAt: expect.any(String),
      },
    )
  })

  it('does not mutate storage when rename confirmation is cancelled', async () => {
    const presetService = createPresetService()
    presetService.listNames.mockResolvedValue(['openai'])
    presetService.read.mockResolvedValue({ env: { OPENAI_API_KEY: 'old' }, createdAt: '2026-05-02T00:00:00.000Z' })
    const projectEnvService = createProjectEnvService()
    projectEnvService.readWithMeta.mockResolvedValue({ env: {} })

    const showPresets = createShowPresetsCommand({
      presetService,
      projectEnvService,
      renderShow: vi
        .fn<() => Promise<ShowActionResult>>()
        .mockResolvedValueOnce({
          type: 'rename',
          preset: { name: 'openai', env: { OPENAI_API_KEY: 'old' }, source: 'global' },
          nextName: 'new-name',
          confirmed: false,
        })
        .mockResolvedValueOnce({ type: 'exit' }),
      cwd: '/tmp/demo-project',
      openDirectory: vi.fn(),
    })

    await showPresets()

    expect(presetService.write).not.toHaveBeenCalled()
    expect(presetService.remove).not.toHaveBeenCalled()
  })
})
