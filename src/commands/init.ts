import React from 'react'
import { Box, Text } from 'ink'

import { CliError } from '../core/errors.js'
import { envMapSchema, type EnvMap, type InitHistoryRecord, type SourceEntry } from '../core/schema.js'
import type { ClaudeSettingsSource } from '../services/claude-settings-env-service.js'
import type { ShellWriteRecord } from '../services/shell-env-service.js'

const h = React.createElement

const requiredInitKeys = [
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_REASONING_MODEL',
] as const

type ClaudeSettingsEnvService = {
  read: () => Promise<ClaudeSettingsSource[]>
  write: (sources: Array<{ path: string; env: EnvMap }>) => Promise<void>
}

type ShellEnvService = {
  write: (env: EnvMap) => Promise<ShellWriteRecord[]>
}

type HistoryService = {
  write: (record: InitHistoryRecord) => Promise<unknown>
}

type InitFlowResult = {
  selectedKeys: string[]
  confirmed?: boolean
}

function omitKeys(env: EnvMap, keys: string[]): EnvMap {
  return envMapSchema.parse(
    Object.fromEntries(Object.entries(env).filter(([key]) => !keys.includes(key))),
  )
}

export function createInitCommand({
  claudeSettingsEnvService,
  shellEnvService,
  historyService,
  renderFlow,
  renderEnvSummary,
}: {
  claudeSettingsEnvService: ClaudeSettingsEnvService
  shellEnvService: ShellEnvService
  historyService: HistoryService
  renderFlow: (context: {
    keys: string[]
    requiredKeys: string[]
    yes: boolean
    sourceFiles: string[]
  }) => Promise<InitFlowResult | void> | InitFlowResult | void
  renderEnvSummary: (props: {
    title: string
    env: EnvMap
    fromFiles?: string[]
    toFiles?: string[]
    footer?: React.ReactNode
  }) => Promise<void>
}) {
  return async function init({ yes = false }: { yes?: boolean } = {}): Promise<void> {
    const sources = await claudeSettingsEnvService.read()

    if (sources.every((s) => !s.exists)) {
      throw new CliError('No Claude settings files were found')
    }

    const effectiveEnv = envMapSchema.parse(
      sources.reduce<Record<string, unknown>>((acc, source) => ({ ...acc, ...source.env }), {}),
    )
    const keys = Object.keys(effectiveEnv).sort()
    const requiredKeys = requiredInitKeys.filter((key) => key in effectiveEnv)
    const sourceFiles = sources.map((s) => s.path)
    const result = await renderFlow({ keys, requiredKeys, yes, sourceFiles })

    if (!result?.confirmed) {
      return
    }

    const migratedEnv = envMapSchema.parse(
      Object.fromEntries(
        result.selectedKeys
          .filter((key) => key in effectiveEnv)
          .map((key) => [key, effectiveEnv[key]]),
      ),
    )

    if (Object.keys(migratedEnv).length === 0) {
      throw new CliError('No selected env values found to migrate')
    }

    const initSources: SourceEntry[] = sources.map((source) => ({
      file: source.path,
      backup: envMapSchema.parse(
        Object.fromEntries(
          result.selectedKeys
            .filter((key) => key in source.env)
            .map((key) => [key, source.env[key]]),
        ),
      ),
    }))

    const timestamp = new Date().toISOString()
    const shellWrites = await shellEnvService.write(migratedEnv)

    await historyService.write({
      timestamp,
      action: 'init',
      migratedKeys: result.selectedKeys,
      sources: initSources,
      shellWrites,
    })

    await claudeSettingsEnvService.write(
      sources.map((source) => ({
        path: source.path,
        env: omitKeys(source.env, result.selectedKeys),
      })),
    )

    await renderEnvSummary({
      title: 'Migrated',
      env: migratedEnv,
      fromFiles: initSources.map((s) => s.file),
      toFiles: shellWrites.map((sw) => sw.filePath),
      footer: h(Box, { flexDirection: 'column' },
        h(Text, { color: 'green' }, 'Init complete'),
        h(Text, { bold: true, color: 'green' }, 'Please restart your terminal for the migrated environment variables to take effect.'),
      ),
    })
  }
}
