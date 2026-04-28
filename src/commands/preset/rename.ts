import { CliError } from '../../core/errors.js'
import type { EnvMap } from '../../core/schema.js'

type PresetService = {
  listNames: () => Promise<string[]>
  read: (name: string) => Promise<{ env: EnvMap; createdAt: string }>
  write: (preset: { name: string; env: EnvMap; createdAt: string; updatedAt: string }) => Promise<unknown>
  remove: (name: string) => Promise<void>
}

export function createRenamePresetCommand({ presetService }: { presetService: PresetService }) {
  return async function renamePreset({ from, to }: { from: string; to: string }): Promise<void> {
    if (!from || !to) throw new CliError('Usage: cc-env rename <from> <to>')
    if (from === to) throw new CliError('New name must be different from the current name')

    const existing = await presetService.read(from)
    const names = await presetService.listNames()
    if (names.includes(to)) throw new CliError(`Preset "${to}" already exists`)

    await presetService.write({ ...existing, name: to, updatedAt: new Date().toISOString() })
    await presetService.remove(from)
    process.stdout.write(`Renamed preset "${from}" → "${to}"\n`)
  }
}
