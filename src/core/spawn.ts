import spawn from 'cross-spawn'

import { CliError } from './errors.js'

export function spawnCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: 'inherit',
    })

    child.once('error', reject)
    child.once('close', (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (signal) {
        reject(new CliError(`Command terminated by signal ${signal}`))
        return
      }

      if (exitCode === null) {
        reject(new CliError('Command terminated without an exit code'))
        return
      }

      if (exitCode !== 0) {
        reject(new CliError(`Command exited with code ${exitCode}`, exitCode))
        return
      }

      resolve()
    })
  })
}
