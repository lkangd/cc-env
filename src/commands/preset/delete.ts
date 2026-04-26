import type { EnvMap } from '../../core/schema.js'

export type PresetSource = 'global' | 'project'

type PresetService = {
  listNames: () => Promise<string[]>
  read: (name: string) => Promise<{ env: EnvMap }>
  remove: (name: string) => Promise<void>
}

type ProjectEnvService = {
  readWithMeta: () => Promise<{ env: EnvMap; name?: string | undefined }>
  write: (env: EnvMap) => Promise<EnvMap>
}

export type PresetDeleteItem = {
  name: string
  env: EnvMap
  source: PresetSource
}

export function createDeletePresetCommand({
  presetService,
  projectEnvService,
  renderDelete,
}: {
  presetService: PresetService
  projectEnvService: ProjectEnvService
  renderDelete: (presets: Array<PresetDeleteItem>) => Promise<PresetDeleteItem | undefined>
}) {
  return async function deletePreset(): Promise<void> {
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

    const selected = await renderDelete(presets)
    if (!selected) return

    if (selected.source === 'project') {
      await projectEnvService.write({})
    } else {
      await presetService.remove(selected.name)
    }

    console.log(`Deleted preset: ${selected.name}`)
  }
}
