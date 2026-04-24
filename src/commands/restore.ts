import { CliError } from '../core/errors.js'
import type { EnvMap, HistoryRecord, Preset } from '../core/schema.js'

type HistoryService = {
  list: () => Promise<HistoryRecord[]>
}

type SettingsEnvService = {
  read: () => Promise<EnvMap>
  write: (env: EnvMap) => Promise<unknown>
}

type PresetService = {
  read: (name: string) => Promise<Preset>
  write: (preset: Preset) => Promise<unknown>
}

type RestoreFlowResult = {
  confirmed?: boolean
  timestamp?: string
  targetType?: 'settings' | 'preset'
  targetName?: string
}

export function createRestoreCommand({
  historyService,
  settingsEnvService,
  presetService,
  renderFlow,
}: {
  historyService: HistoryService
  settingsEnvService: SettingsEnvService
  presetService: PresetService
  renderFlow: (context: {
    records: HistoryRecord[]
    yes: boolean
  }) => Promise<RestoreFlowResult | void> | RestoreFlowResult | void
}) {
  return async function restore({ yes = false }: { yes?: boolean } = {}): Promise<void> {
    const records = await historyService.list()
    const result = await renderFlow({ records, yes })

    if (!result?.confirmed) {
      return
    }

    const record = records.find((entry) => entry.timestamp === result.timestamp)

    if (!record) {
      throw new CliError('Restore record not found')
    }

    if (result.targetType === 'settings') {
      const currentSettings = await settingsEnvService.read()
      await settingsEnvService.write({
        ...currentSettings,
        ...record.backup,
      })
      return
    }

    const presetName = result.targetName ?? record.targetName
    const preset = await presetService.read(presetName)

    await presetService.write({
      ...preset,
      updatedAt: new Date().toISOString(),
      env: {
        ...preset.env,
        ...record.backup,
      },
    })
  }
}
