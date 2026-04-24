import { Command } from 'commander'

import { createDebugCommand } from './commands/debug.js'
import { createShowPresetCommand } from './commands/preset/show.js'
import { createPresetService } from './services/preset-service.js'
import { createProjectEnvService } from './services/project-env-service.js'
import { createRuntimeEnvService } from './services/runtime-env-service.js'
import { createSettingsEnvService } from './services/settings-env-service.js'

const program = new Command()

program.name('cc-env')

for (const commandName of ['run', 'init', 'restore']) {
  program.command(commandName)
}

const settingsPath = `${process.cwd()}/settings.json`
const globalRoot = `${process.cwd()}/.cc-env-global`

const settingsEnvService = createSettingsEnvService({ settingsPath })
const projectEnvService = createProjectEnvService({ cwd: process.cwd() })
const runtimeEnvService = createRuntimeEnvService()
const presetService = createPresetService(globalRoot)

const presetCommand = program.command('preset')
presetCommand.command('show <name>').action(
  createShowPresetCommand({ presetService }),
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
