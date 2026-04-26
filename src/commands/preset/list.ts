import type { EnvMap } from '../../core/schema.js'

type PresetService = {
  listNames: () => Promise<string[]>
  read: (name: string) => Promise<{ env: EnvMap }>
}

type ProjectEnvService = {
  readWithMeta: () => Promise<{ env: EnvMap; name?: string | undefined }>
}

export type PresetSource = 'global' | 'project'

export type PresetListItem = {
  name: string
  env: EnvMap
  source: PresetSource
}

export function createListPresetsCommand({
  presetService,
  projectEnvService,
  renderList,
}: {
  presetService: PresetService
  projectEnvService: ProjectEnvService
  renderList: (presets: Array<PresetListItem>) => Promise<void>
}) {
  return async function listPresets(): Promise<void> {
    const names = await presetService.listNames()
    const globalPresets = await Promise.all(
      names.map((name) =>
        presetService.read(name).then((p) => ({ name, env: p.env, source: 'global' as const })),
      ),
    )

    const { env: projectEnv, name: projectName } = await projectEnvService.readWithMeta()
    const projectPreset =
      Object.keys(projectEnv).length > 0
        ? [{ name: projectName ?? 'project', env: projectEnv, source: 'project' as const }]
        : []

    const presets = [...projectPreset, ...globalPresets]
    if (presets.length === 0) {
      console.log('No presets found.')
      return
    }

    await renderList(presets)
  }
}
