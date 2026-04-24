import lockfile from 'proper-lockfile'

import { ensureParentDir } from './fs.js'

export async function withFileLock<T>(filePath: string, run: () => Promise<T>): Promise<T> {
  await ensureParentDir(filePath)
  const release = await lockfile.lock(filePath, {
    realpath: false,
    retries: {
      retries: 3,
      factor: 1,
    },
  })

  try {
    return await run()
  } finally {
    await release()
  }
}
