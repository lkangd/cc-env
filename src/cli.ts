#!/usr/bin/env node

import React from 'react'
import { render } from 'ink'
import { join } from 'node:path'
import figlet from 'figlet'
import gradient from 'gradient-string'

import { Command } from 'commander'
import packageJson from '../package.json' with { type: 'json' }

const h = React.createElement

import { createPresetCreateCommand } from './commands/preset/create.js'
import { createDeletePresetCommand } from './commands/preset/delete.js'
import { createEditPresetCommand } from './commands/preset/edit.js'
import { createRenamePresetCommand } from './commands/preset/rename.js'
import { PresetDeleteApp } from './ink/preset-delete-app.js'
import { PresetEditApp } from './ink/preset-edit-app.js'
import { createShowPresetsCommand } from './commands/preset/show.js'
import { createRestoreCommand } from './commands/restore.js'
import { createRunCommand } from './commands/run.js'
import { runDoctorCommand } from './commands/doctor.js'
import { findClaudeExecutable } from './core/find-claude.js'
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

program
  .name('cc-env')
  .description('Manage runtime environment variables for Claude Code')
  .version(packageJson.version)
  .option('--verbose', 'Enable verbose output')
  .option('--quiet', 'Suppress non-essential output')
  .option('--no-interactive', 'Disable interactive prompts (equivalent to -y)')

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
const projectStateService = createProjectStateService(globalRoot)

async function runPresetCreateFlow({ detectedEnv, requiredKeys }: { detectedEnv: Record<string, string>; requiredKeys: string[] }) {
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
      projectEnvPath: join(cwd, '.cc-env', 'env.json'),
      detectedEnv,
      requiredKeys,
    })
  )

  await app.waitUntilExit()
  return result
}

async function runWithBootstrap({
  args = [],
  dryRun = false,
  yes = false,
  json = false,
  skipDetect = false,
}: {
  args?: string[]
  dryRun?: boolean
  yes?: boolean
  json?: boolean
  skipDetect?: boolean
}) {
  const result = await createRunCommand({
    claudeSettingsEnvService,
    presetService,
    projectEnvService,
    projectStateService,
    findClaude: findClaudeExecutable,
    renderPresetSelect: async ({ presets, defaultIndex }) => {
      let selected: (typeof presets)[number] | undefined
      const app = render(
        h(RunPresetSelectApp, {
          presets,
          defaultIndex,
          onSubmit: preset => {
            selected = preset
          }
        })
      )
      await app.waitUntilExit()
      return selected
    },
    spawnCommand
  })({
    args,
    dryRun,
    yes,
    json,
    skipDetect,
    cwd,
  })

  if (!result || result.status === 'executed') {
    return
  }

  if (Object.keys(result.detectedEnv).length === 0) {
    throw new CliError('No presets found and no migratable Claude settings were detected.')
  }

  const createdPreset = await createPresetCreateCommand({
    presetService,
    projectEnvService,
    claudeSettingsEnvService,
    historyService,
    renderFlow: runPresetCreateFlow,
  })({ cwd })

  if (!createdPreset) {
    return
  }

  await projectStateService.saveLastPreset(cwd, createdPreset)
  await runWithBootstrap({
    args,
    dryRun,
    yes: true,
    json,
    skipDetect: true,
  })
}

async function runRestoreFlow(context: { records: Awaited<ReturnType<typeof historyService.list>>; yes: boolean }) {
  const state = createRestoreFlowState(context.records, cwd)
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

    if (firstRecord.action === 'init' || firstRecord.action === 'preset-create') {
      const doneState = advanceRestoreFlow(selectedRecordState, { type: 'confirm' })
      if (doneState.step !== 'done') {
        return undefined
      }

      return {
        confirmed: true,
        timestamp: firstRecord.timestamp,
      }
    }

    if (firstRecord.action !== 'restore') {
      return undefined
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
        ...(doneState.targetType ? { targetType: doneState.targetType } : {}),
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
  .option('--json', 'Output as JSON (only with --dry-run)')
  .action((args, options) => {
    const rawArgs = args ?? []
    return runWithBootstrap({
      args: rawArgs,
      dryRun: options.dryRun ?? false,
      yes: options.yes ?? false,
      json: options.json ?? false,
    })
  })

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
  .option('--json', 'Output as JSON')
  .action((options) =>
    createShowPresetsCommand({
      presetService,
      projectEnvService,
      renderShow: async presets => {
        if (options.json) {
          process.stdout.write(JSON.stringify(presets, null, 2) + '\n')
          return
        }
        const app = render(h(PresetShowApp, { presets }))
        await app.waitUntilExit()
      }
    })()
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
  .action(async () => {
    await createPresetCreateCommand({
      presetService,
      projectEnvService,
      claudeSettingsEnvService,
      historyService,
      renderFlow: runPresetCreateFlow,
    })({ cwd })
  })

program
  .command('doctor')
  .description('Check system health and configuration')
  .option('--json', 'Output as JSON')
  .action((options) => runDoctorCommand({ cwd, json: options.json }))

program
  .command('edit <name>')
  .description('Edit an existing preset')
  .action((name) =>
    createEditPresetCommand({
      presetService,
      renderEdit: async (preset) => {
        let result: { env: Record<string, string>; confirmed: boolean } | undefined
        const app = render(
          h(PresetEditApp, {
            name: preset.name,
            env: preset.env,
            onSubmit: (value) => {
              result = value
            }
          })
        )
        await app.waitUntilExit()
        return result
      }
    })({ name })
  )

program
  .command('rename <from> <to>')
  .description('Rename a preset')
  .action((from, to) =>
    createRenamePresetCommand({ presetService })({ from, to })
  )

program
  .command('completion')
  .description('Generate shell completion script')
  .option('--shell <shell>', 'Shell type (bash, zsh, fish)', 'bash')
  .action(async (options) => {
    const { generateCompletion } = await import('./commands/completion.js')
    process.stdout.write(generateCompletion(options.shell))
  })

function printBanner() {
  const banner = figlet.textSync('CC ENV', { font: 'ANSI Shadow' })
  const line = '─'.repeat(48)
  const styled = gradient(['#00d2ff', '#7b2ff7', '#ff0080'])(banner)
  process.stderr.write(`\n${styled}\x1b[2m\n${line}\x1b[0m\n\n`)
}

program.hook('preAction', (thisCommand) => {
  const opts = program.opts<{ quiet?: boolean }>()
  if (!opts.quiet) printBanner()
  // propagate --no-interactive as -y to subcommands
  const globalOpts = program.opts<{ interactive?: boolean }>()
  if (globalOpts.interactive === false) {
    const subOpts = thisCommand.opts<{ yes?: boolean }>()
    if ('yes' in subOpts) thisCommand.setOptionValue('yes', true)
  }
})

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    const hasGlobalPreset = (await presetService.listNames()).length > 0
    const { env: projectEnv } = await projectEnvService.readWithMeta()

    if (hasGlobalPreset || Object.keys(projectEnv).length > 0) {
      await runWithBootstrap({ args: [], yes: !process.stdin.isTTY })
      return
    }

    program.outputHelp()
    process.exitCode = 0
    return
  }

  await program.parseAsync(process.argv)
}

main().catch((error: unknown) => {
  if (error instanceof CliError) {
    process.stderr.write(`\n  Error: ${error.message}\n\n`)
    process.exitCode = error.exitCode
    return
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const { code, message } = error as { code?: string; message?: string }

    if (code === 'commander.helpDisplayed' || code === 'commander.version') {
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
