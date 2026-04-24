import { spawnSync } from 'node:child_process'

import { CliError } from '../../core/errors.js'

type PresetRecord = {
  filePath: string
}

type PresetService = {
  read: (name: string) => Promise<PresetRecord>
}

export function createEditPresetCommand({
  presetService,
}: {
  presetService: PresetService
}) {
  return async function editPreset(name: string): Promise<void> {
    const editor = process.env.EDITOR

    if (!editor) {
      throw new CliError('EDITOR is required to edit a preset')
    }

    const preset = await presetService.read(name)
    const result = spawnSync(editor, [preset.filePath], { stdio: 'inherit' })

    if (result.status !== 0) {
      throw new CliError(`Editor exited with code ${result.status ?? 1}`)
    }
  }
}
