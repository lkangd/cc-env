import { join, dirname } from 'node:path'

import { CliError } from '../../core/errors.js'
import type { EnvMap } from '../../core/schema.js'

type PresetService = {
  listNames: () => Promise<string[]>
  read: (name: string) => Promise<{ env: EnvMap; createdAt: string }>
  write: (preset: { name: string; env: EnvMap; createdAt: string; updatedAt: string }) => Promise<unknown>
  remove: (name: string) => Promise<void>
  getPath: (name: string) => string
}

type ProjectEnvService = {
  readWithMeta: () => Promise<{
    env: EnvMap
    name?: string | undefined
    createdAt?: string | undefined
    updatedAt?: string | undefined
  }>
  write: (
    env: EnvMap,
    meta?: { name?: string; createdAt?: string; updatedAt?: string },
  ) => Promise<EnvMap>
}

export type PresetSource = 'global' | 'project'

export type PresetShowItem = {
  name: string
  env: EnvMap
  source: PresetSource
}

export type ShowActionResult =
  | { type: 'exit' }
  | { type: 'delete'; preset: PresetShowItem }
  | { type: 'edit'; preset: PresetShowItem; result: { env: EnvMap; confirmed: boolean } }
  | { type: 'rename'; preset: PresetShowItem; nextName: string; confirmed: boolean }
  | { type: 'open-directory'; preset: PresetShowItem }

export function createShowPresetsCommand({
  presetService,
  projectEnvService,
  renderShow,
  cwd,
  openDirectory,
}: {
  presetService: PresetService
  projectEnvService: ProjectEnvService
  renderShow: (presets: Array<PresetShowItem>) => Promise<ShowActionResult | void>
  cwd: string
  openDirectory: (directoryPath: string) => Promise<void>
}) {
  async function loadPresets(): Promise<Array<PresetShowItem>> {
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

    return [...projectPreset, ...globalPresets]
  }

  async function validateRename(nextName: string, current: PresetShowItem): Promise<string> {
    const trimmed = nextName.trim()
    if (!trimmed) throw new CliError('Preset name cannot be empty')
    if (trimmed === current.name) throw new CliError('New name must be different from the current name')

    const globalNames = await presetService.listNames()
    const { name: projectName } = await projectEnvService.readWithMeta()
    const takenNames = new Set([
      ...globalNames.filter((name) => !(current.source === 'global' && name === current.name)),
      ...(projectName && !(current.source === 'project' && projectName === current.name) ? [projectName] : []),
    ])
    if (takenNames.has(trimmed)) throw new CliError(`Preset "${trimmed}" already exists`)
    return trimmed
  }

  function resolvePresetDirectory(preset: PresetShowItem): string {
    if (preset.source === 'project') {
      return join(cwd, '.cc-env')
    }

    return dirname(presetService.getPath(preset.name))
  }

  return async function showPresets(): Promise<void> {
    while (true) {
      const presets = await loadPresets()
      if (presets.length === 0) {
        console.log('No presets found.')
        return
      }

      const action = await renderShow(presets)
      if (!action || action.type === 'exit') return

      if (action.type === 'open-directory') {
        await openDirectory(resolvePresetDirectory(action.preset))
        continue
      }

      if (action.type === 'delete') {
        if (action.preset.source === 'project') {
          await projectEnvService.write({})
        } else {
          await presetService.remove(action.preset.name)
        }
        continue
      }

      if (action.type === 'edit') {
        if (!action.result.confirmed) continue

        const updatedAt = new Date().toISOString()
        if (action.preset.source === 'project') {
          const existing = await projectEnvService.readWithMeta()
          await projectEnvService.write(action.result.env, {
            name: existing.name ?? action.preset.name,
            ...(existing.createdAt ? { createdAt: existing.createdAt } : {}),
            updatedAt,
          })
        } else {
          const existing = await presetService.read(action.preset.name)
          await presetService.write({
            name: action.preset.name,
            env: action.result.env,
            createdAt: existing.createdAt,
            updatedAt,
          })
        }
        continue
      }

      if (!action.confirmed) continue

      const updatedAt = new Date().toISOString()
      const nextName = await validateRename(action.nextName, action.preset)
      if (action.preset.source === 'project') {
        const existing = await projectEnvService.readWithMeta()
        await projectEnvService.write(existing.env, {
          name: nextName,
          ...(existing.createdAt ? { createdAt: existing.createdAt } : {}),
          updatedAt,
        })
      } else {
        const existing = await presetService.read(action.preset.name)
        await presetService.write({
          name: nextName,
          env: existing.env,
          createdAt: existing.createdAt,
          updatedAt,
        })
        await presetService.remove(action.preset.name)
      }
    }
  }
}
