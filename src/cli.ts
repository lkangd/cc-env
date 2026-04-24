import { Command } from 'commander'

import { createDebugCommand } from './commands/debug.js'
import { createDeletePresetCommand } from './commands/preset/delete.js'
import { createEditPresetCommand } from './commands/preset/edit.js'
import { createListPresetsCommand } from './commands/preset/list.js'
import { createShowPresetCommand } from './commands/preset/show.js'
import { createRunCommand } from './commands/run.js'
import { toProcessEnvMap } from './core/process-env.js'
import { spawnCommand } from './core/spawn.js'
import { createConfigService } from './services/config-service.js'
import { createPresetService } from './services/preset-service.js'
import { createProjectEnvService } from './services/project-env-service.js'
import { createRuntimeEnvService } from './services/runtime-env-service.js'
import { createSettingsEnvService } from './services/settings-env-service.js'

const program = new Command()

program.name('cc-env')

const settingsPath = `${process.cwd()}/settings.json`
const globalRoot = `${process.cwd()}/.cc-env-global`

const configService = createConfigService(globalRoot)
const settingsEnvService = createSettingsEnvService({ settingsPath })
const projectEnvService = createProjectEnvService({ cwd: process.cwd() })
const runtimeEnvService = createRuntimeEnvService()
const presetService = createPresetService(globalRoot)

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

for (const commandName of ['init', 'restore']) {
  program.command(commandName)
}

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

program.command('debug').action(
  createDebugCommand({
    settingsEnvService,
    projectEnvService,
    runtimeEnvService,
    processEnv: process.env,
  }),
)

program.parse(process.argv)
