import { formatPresetTable } from '../../core/format.js'

type PresetService = {
  listNames: () => Promise<string[]>
}

export function createListPresetsCommand({
  presetService,
}: {
  presetService: PresetService
}) {
  return async function listPresets(): Promise<void> {
    const names = await presetService.listNames()
    console.log(formatPresetTable(names))
  }
}
