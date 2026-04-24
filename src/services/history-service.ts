import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { atomicWriteFile, ensureParentDir } from '../core/fs.js'
import { withFileLock } from '../core/lock.js'
import { resolveHistoryPath } from '../core/paths.js'
import { historySchema } from '../core/schema.js'
import type { RestoreRecord } from '../flows/restore-flow.js'

type HistoryEntry = RestoreRecord

export function createHistoryService(globalRoot: string) {
  return {
    async write(record: HistoryEntry): Promise<HistoryEntry> {
      const stored = historySchema.parse(record) as HistoryEntry
      const filePath = resolveHistoryPath(globalRoot, stored.timestamp)
      await ensureParentDir(filePath)

      return withFileLock(filePath, async () => {
        await atomicWriteFile(filePath, `${JSON.stringify(stored, null, 2)}\n`)
        return stored
      })
    },

    async list(): Promise<HistoryEntry[]> {
      const dirPath = dirname(resolveHistoryPath(globalRoot, 'placeholder'))

      try {
        const entries = await readdir(dirPath, { withFileTypes: true })
        const fileNames = entries
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map((entry) => entry.name)
          .sort()

        const records = await Promise.all(
          fileNames.map(async (fileName) => {
            const content = await readFile(join(dirPath, fileName), 'utf8')
            return JSON.parse(content) as HistoryEntry
          }),
        )

        return records.map((record) => historySchema.parse(record) as HistoryEntry)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return []
        }

        throw error
      }
    },
  }
}
