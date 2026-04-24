import { spawnSync as defaultSpawnSync } from 'node:child_process'

import { CliError } from '../../core/errors.js'

type PresetRecord = {
  filePath: string
}

type PresetService = {
  read: (name: string) => Promise<PresetRecord>
}

type SpawnSync = typeof defaultSpawnSync

type ProcessEnv = {
  EDITOR?: string
}

export function createEditPresetCommand({
  presetService,
  processEnv = process.env,
  spawnSync = defaultSpawnSync,
}: {
  presetService: PresetService
  processEnv?: ProcessEnv
  spawnSync?: SpawnSync
}) {
  return async function editPreset(name: string): Promise<void> {
    const editor = processEnv.EDITOR

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
