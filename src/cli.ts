import React from 'react'
import { render } from 'ink'
import { join } from 'node:path'

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
import { PresetCreateApp } from './ink/preset-create-app.js'
import {
  advanceRestoreFlow,
  createRestoreFlowState,
} from './flows/restore-flow.js'
import { RestoreApp } from './ink/restore-app.js'
import { toProcessEnvMap } from './core/process-env.js'
import { CliError } from './core/errors.js'
import { resolveGlobalRoot } from './core/paths.js'
import { spawnCommand } from './core/spawn.js'
import { createConfigService } from './services/config-service.js'
import { createHistoryService } from './services/history-service.js'
import { createPresetService } from './services/preset-service.js'
import { createProjectEnvService } from './services/project-env-service.js'
import { createRuntimeEnvService } from './services/runtime-env-service.js'
import { createSettingsEnvService } from './services/settings-env-service.js'

const program = new Command()

program.name('cc-env')

const cwd = process.cwd()
const settingsPath = join(cwd, 'settings.json')
const globalRoot = resolveGlobalRoot()

const configService = createConfigService(globalRoot)
const settingsEnvService = createSettingsEnvService({ settingsPath })
const projectEnvService = createProjectEnvService({ cwd })
const runtimeEnvService = createRuntimeEnvService()
const presetService = createPresetService(globalRoot)
const historyService = createHistoryService(globalRoot)

function runRestoreFlow(context: {
  records: Awaited<ReturnType<typeof historyService.list>>
  yes: boolean
}) {
  const state = createRestoreFlowState(context.records)
  const firstRecord = context.records[0]

  if (!context.yes || !firstRecord) {
    render(h(RestoreApp, { state }))
    return undefined
  }

  const selectedRecordState = advanceRestoreFlow(state, {
    type: 'select-record',
    timestamp: firstRecord.timestamp,
  })
  const confirmState = advanceRestoreFlow(selectedRecordState, {
    type: 'select-target',
    targetType: firstRecord.targetType,
    ...(firstRecord.targetType === 'preset' ? { targetName: firstRecord.targetName } : {}),
  })

  render(h(RestoreApp, { state: confirmState }))

  if (confirmState.step !== 'confirm') {
    return undefined
  }

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

program.exitOverride()

program.command('run [command] [args...]')
  .option('-p, --preset <name>')
  .option('--dry-run')
  .action((command, args, options) =>
    createRunCommand({
      configService,
      presetService,
      envSources: async ({ preset: _preset, presetEnv }) => ({
        settingsEnv: await settingsEnvService.read(),
        processEnv: toProcessEnvMap(process.env),
        presetEnv,
        projectEnv: await projectEnvService.read(),
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
      settingsEnvService,
      presetService,
      historyService,
      renderFlow: async (context) => {
        render(h(InitApp))
        return {
          selectedKeys: context.keys,
          confirmed: context.yes,
          presetName: 'default',
        }
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
      settingsEnvService,
      presetService,
      renderFlow: (context) => runRestoreFlow(context),
    })({
      yes: options.yes,
    }),
  )

const presetCommand = program.command('preset')
presetCommand.command('list').action(
  createListPresetsCommand({ presetService }),
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
presetCommand.command('create [pairs...]')
  .option('-n, --name <name>')
  .option('-f, --file <path>')
  .option('--project')
  .action((pairs, options) =>
    createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow: async (context) => {
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
          }),
        )

        await app.waitUntilExit()
        return result
      },
    })({
      name: options.name,
      file: options.file,
      pairs,
      project: options.project,
    }),
  )

program.command('debug').action(
  createDebugCommand({
    settingsEnvService,
    projectEnvService,
    runtimeEnvService,
    processEnv: process.env,
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
