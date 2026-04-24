type PresetService = {
  remove: (name: string) => Promise<void>
}

export function createDeletePresetCommand({
  presetService,
}: {
  presetService: PresetService
}) {
  return async function deletePreset(name: string): Promise<void> {
    await presetService.remove(name)
  }
}
