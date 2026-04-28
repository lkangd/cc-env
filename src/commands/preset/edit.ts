import { CliError } from '../../core/errors.js'
import type { EnvMap } from '../../core/schema.js'

type PresetService = {
  read: (name: string) => Promise<{ env: EnvMap; createdAt: string }>
  write: (preset: { name: string; env: EnvMap; createdAt: string; updatedAt: string }) => Promise<unknown>
}

type RenderEdit = (preset: {
  name: string
  env: EnvMap
}) => Promise<{ env: EnvMap; confirmed: boolean } | undefined>

export function createEditPresetCommand({
  presetService,
  renderEdit,
}: {
  presetService: PresetService
  renderEdit: RenderEdit
}) {
  return async function editPreset({ name }: { name: string }): Promise<void> {
    if (!name) throw new CliError('Usage: cc-env edit <preset-name>')

    const existing = await presetService.read(name)
    const result = await renderEdit({ name, env: existing.env })

    if (!result?.confirmed) {
      process.stdout.write('Edit cancelled.\n')
      return
    }

    await presetService.write({
      name,
      env: result.env,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    })

    process.stdout.write(`Updated preset "${name}"\n`)
  }
}
