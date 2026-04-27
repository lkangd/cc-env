#!/usr/bin/env node

import React from 'react'
import { render } from 'ink'
import { join } from 'node:path'
import figlet from 'figlet'
import gradient from 'gradient-string'

import { Command } from 'commander'

const h = React.createElement

import { createInitCommand } from './commands/init.js'
import { createPresetCreateCommand } from './commands/preset/create.js'
import { createDeletePresetCommand } from './commands/preset/delete.js'
import { PresetDeleteApp } from './ink/preset-delete-app.js'
import { createShowPresetsCommand } from './commands/preset/show.js'
import { createRestoreCommand } from './commands/restore.js'
import { createRunCommand } from './commands/run.js'
import { findClaudeExecutable } from './core/find-claude.js'
import { InitApp } from './ink/init-app.js'
import { renderEnvSummary } from './ink/summary.js'
import { PresetCreateApp } from './ink/preset-create-app.js'
import { PresetShowApp } from './ink/preset-show-app.js'
import { RunPresetSelectApp } from './ink/run-preset-select-app.js'
import { advanceRestoreFlow, createRestoreFlowState } from './flows/restore-flow.js'
import { RestoreApp } from './ink/restore-app.js'
import { CliError } from './core/errors.js'
import { resolveGlobalRoot } from './core/paths.js'
import { spawnCommand } from './core/spawn.js'
import { createClaudeSettingsEnvService } from './services/claude-settings-env-service.js'
import { createHistoryService } from './services/history-service.js'
import { createPresetService } from './services/preset-service.js'
import { createProjectEnvService } from './services/project-env-service.js'
import { createProjectStateService } from './services/project-state-service.js'
import { createSettingsEnvService } from './services/settings-env-service.js'
import { createShellEnvService } from './services/shell-env-service.js'

const program = new Command()

program.name('cc-env').description('Manage runtime environment variables for Claude Code')

const homeDir = process.env.HOME ?? process.cwd()
const cwd = process.cwd()
const settingsPath = join(cwd, 'settings.json')
const globalRoot = resolveGlobalRoot()

const claudeSettingsEnvService = createClaudeSettingsEnvService({ homeDir, cwd })
const settingsEnvService = createSettingsEnvService({ settingsPath })
const shellEnvService = createShellEnvService({ homeDir })
const projectEnvService = createProjectEnvService({ cwd })
const presetService = createPresetService(globalRoot)
const historyService = createHistoryService(globalRoot)

async function runRestoreFlow(context: { records: Awaited<ReturnType<typeof historyService.list>>; yes: boolean }) {
  const state = createRestoreFlowState(context.records)
  const firstRecord = context.records[0]

  if (!firstRecord) {
    render(h(RestoreApp, { state }))
    return undefined
  }

  if (context.yes) {
    const selectedRecordState = advanceRestoreFlow(state, {
      type: 'select-record',
      timestamp: firstRecord.timestamp
    })

    if (firstRecord.action === 'init') {
      const doneState = advanceRestoreFlow(selectedRecordState, { type: 'confirm' })
      if (doneState.step !== 'done') {
        return undefined
      }

      return {
        confirmed: true,
        timestamp: firstRecord.timestamp
      }
    }

    const confirmState = advanceRestoreFlow(selectedRecordState, {
      type: 'select-target',
      targetType: firstRecord.targetType,
      ...(firstRecord.targetType === 'preset' ? { targetName: firstRecord.targetName } : {})
    })

    const doneState = advanceRestoreFlow(confirmState, { type: 'confirm' })

    if (doneState.step === 'done' && doneState.targetType === 'preset') {
      return {
        confirmed: true,
        timestamp: doneState.selectedTimestamp,
        targetType: doneState.targetType,
        targetName: doneState.targetName
      }
    }

    if (doneState.step === 'done') {
      return {
        confirmed: true,
        timestamp: doneState.selectedTimestamp,
        targetType: doneState.targetType
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
      onSubmit: value => {
        result = value
      }
    })
  )

  await app.waitUntilExit()
  return result
}

program.exitOverride().configureOutput({
  writeErr: str => {
    if (!str.startsWith('error:')) {
      process.stderr.write(str)
    }
  }
})

program
  .command('run [args...]')
  .allowUnknownOption(true)
  .description('Run claude with merged environment variables')
  .option('--dry-run', 'Preview the merged env without executing')
  .option('-y, --yes', 'Auto-select the default preset without interactive prompts')
  .action((args, options) => {
    const rawArgs = args ?? []

    return createRunCommand({
      claudeSettingsEnvService,
      presetService,
      projectEnvService,
      projectStateService: createProjectStateService(globalRoot),
      findClaude: findClaudeExecutable,
      renderPresetSelect: async ({ presets, defaultIndex }) => {
        let result: (typeof presets)[number] | undefined
        const app = render(
          h(RunPresetSelectApp, {
            presets,
            defaultIndex,
            onSubmit: preset => {
              result = preset
            }
          })
        )
        await app.waitUntilExit()
        return result
      },
      spawnCommand
    })({
      args: rawArgs,
      dryRun: options.dryRun ?? false,
      yes: options.yes ?? false,
      cwd
    })
  })

program
  .command('init')
  .description('Initialize cc-env for the current project')
  .option('-y, --yes', 'Accept all defaults without interactive prompts')
  .action(options =>
    createInitCommand({
      claudeSettingsEnvService,
      shellEnvService,
      historyService,
      renderEnvSummary,
      renderFlow: async context => {
        if (context.yes) {
          return {
            selectedKeys: context.requiredKeys,
            confirmed: true
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
            onSubmit: value => {
              result = value
            }
          })
        )

        await app.waitUntilExit()
        return result
      }
    })({
      yes: options.yes
    })
  )

program
  .command('restore')
  .description('Restore environment variables from a previous snapshot')
  .option('-y, --yes', 'Accept all defaults without interactive prompts')
  .action(options =>
    createRestoreCommand({
      historyService,
      claudeSettingsEnvService,
      shellEnvService,
      settingsEnvService,
      presetService,
      renderEnvSummary: renderEnvSummary,
      renderFlow: context => runRestoreFlow(context)
    })({
      yes: options.yes
    })
  )

program
  .command('show')
  .description('List and view all presets')
  .action(
    createShowPresetsCommand({
      presetService,
      projectEnvService,
      renderShow: async presets => {
        const app = render(h(PresetShowApp, { presets }))
        await app.waitUntilExit()
      }
    })
  )

program
  .command('delete')
  .description('Delete a saved preset')
  .action(
    createDeletePresetCommand({
      presetService,
      projectEnvService,
      renderDelete: async presets => {
        let result: (typeof presets)[number] | undefined
        const app = render(
          h(PresetDeleteApp, {
            presets,
            onSubmit: preset => {
              result = preset
            }
          })
        )
        await app.waitUntilExit()
        return result
      }
    })
  )

program
  .command('create')
  .description('Create a new environment preset')
  .action(() =>
    createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow: async () => {
        let result: React.ComponentProps<typeof PresetCreateApp>['onSubmit'] extends (result: infer TResult) => unknown
          ? TResult | undefined
          : undefined
        const app = render(
          h(PresetCreateApp, {
            onSubmit: value => {
              result = value
            },
            readFile: async filePath => {
              const { readEnvFile } = await import('./commands/preset/create.js')
              return readEnvFile(filePath)
            },
            globalPresetPath: name => presetService.getPath(name),
            projectEnvPath: join(cwd, '.cc-env', 'env.json')
          })
        )

        await app.waitUntilExit()
        return result
      }
    })({ cwd })
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

program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof CliError) {
    process.stderr.write(`\n  Error: ${error.message}\n\n`)
    process.exitCode = error.exitCode
    return
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const { code, message } = error as { code?: string; message?: string }

    if (code === 'commander.helpDisplayed') {
      process.exitCode = 0
      return
    }

    const hint = `  Run "cc-env --help" to see available commands and options.\n`
    const formatted = message?.replace(/^error:\s*/i, '') ?? 'Unknown error'
    process.stderr.write(`\n  Error: ${formatted}\n\n${hint}\n`)
    process.exitCode = 1
    return
  }

  throw error
})
