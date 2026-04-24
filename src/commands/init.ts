import { CliError } from '../core/errors.js'
import { envMapSchema, type EnvMap } from '../core/schema.js'

type SettingsEnvService = {
  read: () => Promise<EnvMap>
  write: (env: EnvMap) => Promise<unknown>
}

type PresetService = {
  write: (preset: {
    name: string
    createdAt: string
    updatedAt: string
    env: EnvMap
  }) => Promise<unknown>
}

type HistoryService = {
  write: (record: {
    timestamp: string
    action: 'init'
    movedKeys: string[]
    backup: EnvMap
    targetType: 'preset'
    targetName: string
  }) => Promise<unknown>
}

type InitFlowResult = {
  selectedKeys: string[]
  confirmed?: boolean
  presetName?: string
}

export function createInitCommand({
  settingsEnvService,
  presetService,
  historyService,
  renderFlow,
}: {
  settingsEnvService: SettingsEnvService
  presetService: PresetService
  historyService: HistoryService
  renderFlow: (context: {
    keys: string[]
    yes: boolean
  }) => Promise<InitFlowResult | void> | InitFlowResult | void
}) {
  return async function init({ yes = false }: { yes?: boolean } = {}): Promise<void> {
    const currentEnv = await settingsEnvService.read()
    const keys = Object.keys(currentEnv)

    if (keys.length === 0) {
      console.log('No env field found')
      return
    }

    const result = await renderFlow({ keys, yes })

    if (!result?.confirmed) {
      return
    }

    const migratedEntries = envMapSchema.parse(
      Object.fromEntries(
        result.selectedKeys
          .filter((key) => key in currentEnv)
          .map((key) => [key, currentEnv[key]]),
      ),
    )

    const remainingEntries = envMapSchema.parse(
      Object.fromEntries(
        Object.entries(currentEnv).filter(([key]) => !result.selectedKeys.includes(key)),
      ),
    )

    if (!result.presetName) {
      throw new CliError('A preset name is required')
    }

    const timestamp = new Date().toISOString()

    await presetService.write({
      name: result.presetName,
      createdAt: timestamp,
      updatedAt: timestamp,
      env: migratedEntries,
    })
    await historyService.write({
      timestamp,
      action: 'init',
      movedKeys: result.selectedKeys,
      backup: migratedEntries,
      targetType: 'preset',
      targetName: result.presetName,
    })
    await settingsEnvService.write(remainingEntries)
  }
}
