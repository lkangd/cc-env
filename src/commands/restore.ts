import React from 'react'
import { Box, Text } from 'ink'

import { CliError } from '../core/errors.js'
import { resolveClaudeSettingsLocalPath, resolveClaudeSettingsPath } from '../core/paths.js'
import type { EnvMap, HistoryRecord, Preset } from '../core/schema.js'
import type { ShellWriteRecord } from '../services/shell-env-service.js'

const h = React.createElement

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
  renderEnvSummary,
  homeDir,
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
  renderEnvSummary: (props: {
    title: string
    env: EnvMap
    fromFiles?: string[]
    toFiles?: string[]
    footer?: React.ReactNode
  }) => Promise<void>
  homeDir?: string
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
      const settingsPath = resolveClaudeSettingsPath(homeDir)
      const settingsLocalPath = resolveClaudeSettingsLocalPath(homeDir)
      const settingsSource = record.sources.find((s) => s.file === settingsPath)
      const settingsLocalSource = record.sources.find((s) => s.file === settingsLocalPath)

      const mergedBackup = Object.fromEntries(
        record.sources.flatMap((s) => Object.entries(s.backup)),
      )

      const current = await claudeSettingsEnvService.read()
      await shellEnvService.removeKeys(record.shellWrites, record.migratedKeys)
      await claudeSettingsEnvService.write({
        settingsEnv: {
          ...current.settings.env,
          ...(settingsSource?.backup ?? {}),
        },
        settingsLocalEnv: {
          ...current.settingsLocal.env,
          ...(settingsLocalSource?.backup ?? {}),
        },
      })

      await renderEnvSummary({
        title: 'Restored',
        env: mergedBackup,
        fromFiles: record.shellWrites.map((sw) => sw.filePath),
        toFiles: record.sources.map((s) => s.file),
        footer: h(Box, { flexDirection: 'column' },
          h(Text, { color: 'green' }, 'Restore complete'),
          h(Text, { bold: true, color: 'green' }, 'Please restart your terminal for the restored environment variables to take effect.'),
        ),
      })
      return
    }

    if (result.targetType === 'settings') {
      const currentSettings = await settingsEnvService.read()
      await settingsEnvService.write({
        ...currentSettings,
        ...record.backup,
      })

      await renderEnvSummary({
        title: 'Restored to settings',
        env: record.backup,
        footer: h(Box, { flexDirection: 'column' },
          h(Text, { color: 'green' }, 'Restore complete'),
          h(Text, { bold: true, color: 'green' }, 'Please restart your terminal for the restored environment variables to take effect.'),
        ),
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

    await renderEnvSummary({
      title: `Restored to preset ${presetName}`,
      env: record.backup,
      footer: h(Box, { flexDirection: 'column' },
        h(Text, { color: 'green' }, 'Restore complete'),
        h(Text, { bold: true, color: 'green' }, 'Please restart your terminal for the restored environment variables to take effect.'),
      ),
    })
  }
}
