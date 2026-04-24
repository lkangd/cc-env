import { Command } from 'commander'

const program = new Command()

program.name('cc-env')

for (const commandName of ['run', 'init', 'restore', 'preset', 'debug']) {
  program.command(commandName)
}

program.parse(process.argv)
