import pino from 'pino'

import { ensureParentDir } from './fs.js'
import { resolveLogPath } from './paths.js'

export async function createLogger(globalRoot: string) {
  const logPath = resolveLogPath(globalRoot)
  await ensureParentDir(logPath)

  return pino(pino.destination(logPath))
}
