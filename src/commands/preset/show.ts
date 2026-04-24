import { formatEnvBlock } from '../../core/format.js'
import type { EnvMap } from '../../core/schema.js'

type PresetRecord = {
  name: string
  env: EnvMap
}

type PresetService = {
  read: (name: string) => Promise<PresetRecord>
}

export function createShowPresetCommand({
  presetService,
}: {
  presetService: PresetService
}) {
  return async function showPreset(name: string): Promise<void> {
    const preset = await presetService.read(name)
    const envBlock = formatEnvBlock(preset.env)

    console.log(envBlock ? `Preset: ${preset.name}\n${envBlock}` : `Preset: ${preset.name}`)
  }
}
