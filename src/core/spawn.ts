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
    child.once('close', (exitCode) => {
      if (exitCode && exitCode !== 0) {
        reject(new CliError(`Command exited with code ${exitCode}`, exitCode))
        return
      }

      resolve()
    })
  })
}
