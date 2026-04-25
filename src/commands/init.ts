import { CliError } from '../core/errors.js'
import { envMapSchema, type EnvMap, type InitHistoryRecord } from '../core/schema.js'
import type { ShellWriteRecord } from '../services/shell-env-service.js'

const requiredInitKeys = [
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_REASONING_MODEL',
] as const

type ClaudeSettingsEnvService = {
  read: () => Promise<{
    settings: { exists: boolean; env: EnvMap }
    settingsLocal: { exists: boolean; env: EnvMap }
  }>
  write: (input: { settingsEnv: EnvMap; settingsLocalEnv: EnvMap }) => Promise<void>
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
}: {
  claudeSettingsEnvService: ClaudeSettingsEnvService
  shellEnvService: ShellEnvService
  historyService: HistoryService
  renderFlow: (context: {
    keys: string[]
    requiredKeys: string[]
    yes: boolean
  }) => Promise<InitFlowResult | void> | InitFlowResult | void
}) {
  return async function init({ yes = false }: { yes?: boolean } = {}): Promise<void> {
    const sources = await claudeSettingsEnvService.read()

    if (!sources.settings.exists && !sources.settingsLocal.exists) {
      throw new CliError('Claude settings.json and settings.local.json were not found')
    }

    const effectiveEnv = envMapSchema.parse({
      ...sources.settings.env,
      ...sources.settingsLocal.env,
    })
    const keys = Object.keys(effectiveEnv).sort()
    const requiredKeys = requiredInitKeys.filter((key) => key in effectiveEnv)
    const result = await renderFlow({ keys, requiredKeys, yes })

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

    const settingsBackup = envMapSchema.parse(
      Object.fromEntries(
        result.selectedKeys
          .filter((key) => key in sources.settings.env)
          .map((key) => [key, sources.settings.env[key]]),
      ),
    )
    const settingsLocalBackup = envMapSchema.parse(
      Object.fromEntries(
        result.selectedKeys
          .filter((key) => key in sources.settingsLocal.env)
          .map((key) => [key, sources.settingsLocal.env[key]]),
      ),
    )

    const timestamp = new Date().toISOString()
    const shellWrites = await shellEnvService.write(migratedEnv)

    await historyService.write({
      timestamp,
      action: 'init',
      migratedKeys: result.selectedKeys,
      settingsBackup,
      settingsLocalBackup,
      shellWrites,
    })

    await claudeSettingsEnvService.write({
      settingsEnv: omitKeys(sources.settings.env, result.selectedKeys),
      settingsLocalEnv: omitKeys(sources.settingsLocal.env, result.selectedKeys),
    })
  }
}
