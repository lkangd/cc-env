import React from 'react'
import { render } from 'ink'
import { join } from 'node:path'
import figlet from 'figlet'
import gradient from 'gradient-string'

import { Command } from 'commander'

const h = React.createElement

import { createDebugCommand } from './commands/debug.js'
import { createInitCommand } from './commands/init.js'
import { createPresetCreateCommand } from './commands/preset/create.js'
import { createDeletePresetCommand } from './commands/preset/delete.js'
import { createEditPresetCommand } from './commands/preset/edit.js'
import { createListPresetsCommand } from './commands/preset/list.js'
import { createShowPresetCommand } from './commands/preset/show.js'
import { createRestoreCommand } from './commands/restore.js'
import { createRunCommand } from './commands/run.js'
import { InitApp } from './ink/init-app.js'
import { renderEnvSummary } from './ink/summary.js'
import { PresetCreateApp } from './ink/preset-create-app.js'
import { PresetListApp } from './ink/preset-list-app.js'
import {
  advanceRestoreFlow,
  createRestoreFlowState,
} from './flows/restore-flow.js'
import { RestoreApp } from './ink/restore-app.js'
import { toProcessEnvMap } from './core/process-env.js'
import { CliError } from './core/errors.js'
import { resolveGlobalRoot } from './core/paths.js'
import { spawnCommand } from './core/spawn.js'
import { createClaudeSettingsEnvService } from './services/claude-settings-env-service.js'
import { createConfigService } from './services/config-service.js'
import { createHistoryService } from './services/history-service.js'
import { createPresetService } from './services/preset-service.js'
import { createProjectEnvService } from './services/project-env-service.js'
import { createRuntimeEnvService } from './services/runtime-env-service.js'
import { createSettingsEnvService } from './services/settings-env-service.js'
import { createShellEnvService } from './services/shell-env-service.js'

const program = new Command()

program.name('cc-env')

const homeDir = process.env.HOME ?? process.cwd()
const cwd = process.cwd()
const settingsPath = join(cwd, 'settings.json')
const globalRoot = resolveGlobalRoot()

const configService = createConfigService(globalRoot)
const claudeSettingsEnvService = createClaudeSettingsEnvService({ homeDir })
const settingsEnvService = createSettingsEnvService({ settingsPath })
const shellEnvService = createShellEnvService({ homeDir })
const projectEnvService = createProjectEnvService({ cwd })
const runtimeEnvService = createRuntimeEnvService()
const presetService = createPresetService(globalRoot)
const historyService = createHistoryService(globalRoot)

async function runRestoreFlow(context: {
  records: Awaited<ReturnType<typeof historyService.list>>
  yes: boolean
}) {
  const state = createRestoreFlowState(context.records)
  const firstRecord = context.records[0]

  if (!firstRecord) {
    render(h(RestoreApp, { state }))
    return undefined
  }

  if (context.yes) {
    const selectedRecordState = advanceRestoreFlow(state, {
      type: 'select-record',
      timestamp: firstRecord.timestamp,
    })

    if (firstRecord.action === 'init') {
      const doneState = advanceRestoreFlow(selectedRecordState, { type: 'confirm' })
      if (doneState.step !== 'done') {
        return undefined
      }

      return {
        confirmed: true,
        timestamp: firstRecord.timestamp,
      }
    }

    const confirmState = advanceRestoreFlow(selectedRecordState, {
      type: 'select-target',
      targetType: firstRecord.targetType,
      ...(firstRecord.targetType === 'preset' ? { targetName: firstRecord.targetName } : {}),
    })

    const doneState = advanceRestoreFlow(confirmState, { type: 'confirm' })

    if (doneState.step === 'done' && doneState.targetType === 'preset') {
      return {
        confirmed: true,
        timestamp: doneState.selectedTimestamp,
        targetType: doneState.targetType,
        targetName: doneState.targetName,
      }
    }

    if (doneState.step === 'done') {
      return {
        confirmed: true,
        timestamp: doneState.selectedTimestamp,
        targetType: doneState.targetType,
      }
    }

    return undefined
  }

  let result:
    | {
        confirmed: boolean
        timestamp?: string
        targetType?: 'settings' | 'preset'
        targetName?: string
      }
    | undefined

  const app = render(
    h(RestoreApp, {
      state,
      onSubmit: (value) => {
        result = value
      },
    }),
  )

  await app.waitUntilExit()
  return result
}

program.exitOverride()

program.command('run [command] [args...]')
  .option('-p, --preset <name>')
  .option('--dry-run')
  .action((command, args, options) =>
    createRunCommand({
      configService,
      presetService,
      envSources: async ({ preset: _preset, presetEnv }) => ({
        processEnv: toProcessEnvMap(process.env),
        settingsEnv: await settingsEnvService.read(),
        projectEnv: await projectEnvService.read(),
        presetEnv,
      }),
      runtimeEnvService,
      spawnCommand,
    })({
      preset: options.preset,
      dryRun: options.dryRun,
      command,
      args,
    }),
  )

program.command('init')
  .option('-y, --yes')
  .action((options) =>
    createInitCommand({
      claudeSettingsEnvService,
      shellEnvService,
      historyService,
      homeDir,
      renderEnvSummary,
      renderFlow: async (context) => {
        if (context.yes) {
          return {
            selectedKeys: context.requiredKeys,
            confirmed: true,
          }
        }

        let result:
          | {
              selectedKeys: string[]
              confirmed: boolean
            }
          | undefined

        const app = render(
          h(InitApp, {
            ...context,
            onSubmit: (value) => {
              result = value
            },
          }),
        )

        await app.waitUntilExit()
        return result
      },
    })({
      yes: options.yes,
    }),
  )

program.command('restore')
  .option('-y, --yes')
  .action((options) =>
    createRestoreCommand({
      historyService,
      claudeSettingsEnvService,
      shellEnvService,
      settingsEnvService,
      presetService,
      homeDir,
      renderEnvSummary: renderEnvSummary,
      renderFlow: (context) => runRestoreFlow(context),
    })({
      yes: options.yes,
    }),
  )

const presetCommand = program.command('preset')
presetCommand.command('list').action(
  createListPresetsCommand({
    presetService,
    projectEnvService,
    renderList: async (presets) => {
      const app = render(h(PresetListApp, { presets }))
      await app.waitUntilExit()
    },
  }),
)
presetCommand.command('show <name>').action(
  createShowPresetCommand({ presetService }),
)
presetCommand.command('delete <name>').action(
  createDeletePresetCommand({ presetService }),
)
presetCommand.command('edit <name>').action(
  createEditPresetCommand({ presetService }),
)
presetCommand.command('create')
  .action(() =>
    createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow: async () => {
        let result: React.ComponentProps<typeof PresetCreateApp>['onSubmit'] extends (
          result: infer TResult,
        ) => unknown
          ? TResult | undefined
          : undefined
        const app = render(
          h(PresetCreateApp, {
            onSubmit: (value) => {
              result = value
            },
            readFile: async (filePath) => {
              const { readEnvFile } = await import('./commands/preset/create.js')
              return readEnvFile(filePath)
            },
            globalPresetPath: (name) => presetService.getPath(name),
            projectEnvPath: join(cwd, '.cc-env', 'env.json'),
          }),
        )

        await app.waitUntilExit()
        return result
      },
    })(),
  )

function printBanner() {
  const banner = figlet.textSync('CC ENV', { font: 'ANSI Shadow' })
  const line = '─'.repeat(48)
  const styled = gradient(['#00d2ff', '#7b2ff7', '#ff0080'])(banner)
  process.stderr.write(`\n${styled}\x1b[2m\n${line}\x1b[0m\n\n`)
}

program.hook('preAction', () => {
  printBanner()
})

program.command('debug').action(
  createDebugCommand({
    processEnv: process.env,
    settingsEnvService,
    projectEnvService,
    runtimeEnvService,
  }),
)

program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof CliError) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = error.exitCode
    return
  }

  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'commander.helpDisplayed'
  ) {
    process.exitCode = 0
    return
  }

  throw error
})
