import { CliError } from '../core/errors.js'
import type { EnvMap, HistoryRecord, Preset } from '../core/schema.js'
import type { ShellWriteRecord } from '../services/shell-env-service.js'

type HistoryService = {
  list: () => Promise<HistoryRecord[]>
}

type ClaudeSettingsEnvService = {
  read: () => Promise<{
    settings: { env: EnvMap }
    settingsLocal: { env: EnvMap }
  }>
  write: (input: { settingsEnv: EnvMap; settingsLocalEnv: EnvMap }) => Promise<void>
}

type ShellEnvService = {
  removeKeys: (shellWrites: ShellWriteRecord[], keys: string[]) => Promise<void>
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
  claudeSettingsEnvService,
  shellEnvService,
  settingsEnvService,
  presetService,
  renderFlow,
  stdout = process.stdout,
}: {
  historyService: HistoryService
  claudeSettingsEnvService: ClaudeSettingsEnvService
  shellEnvService: ShellEnvService
  settingsEnvService: SettingsEnvService
  presetService: PresetService
  renderFlow: (context: {
    records: HistoryRecord[]
    yes: boolean
  }) => Promise<RestoreFlowResult | void> | RestoreFlowResult | void
  stdout?: Pick<NodeJS.WriteStream, 'write'>
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

    if (record.action === 'init') {
      const current = await claudeSettingsEnvService.read()
      await shellEnvService.removeKeys(record.shellWrites, record.migratedKeys)
      await claudeSettingsEnvService.write({
        settingsEnv: {
          ...current.settings.env,
          ...record.settingsBackup,
        },
        settingsLocalEnv: {
          ...current.settingsLocal.env,
          ...record.settingsLocalBackup,
        },
      })
      stdout.write('Restore complete\n')
      return
    }

    if (result.targetType === 'settings') {
      const currentSettings = await settingsEnvService.read()
      await settingsEnvService.write({
        ...currentSettings,
        ...record.backup,
      })
      stdout.write('Restore complete\n')
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
    stdout.write('Restore complete\n')
  }
}
