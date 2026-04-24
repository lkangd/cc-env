import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { ensureParentDir } from '../core/fs.js'
import { withFileLock } from '../core/lock.js'
import { resolveHistoryPath } from '../core/paths.js'
import { historySchema } from '../core/schema.js'

type HistoryEntry = {
  action: 'init' | 'restore'
  targetType: 'settings' | 'preset'
  targetName: string
  timestamp: string
}

export function createHistoryService(globalRoot: string) {
  return {
    async write(record: HistoryEntry): Promise<HistoryEntry> {
      const parsed = historySchema.parse({
        action: record.action,
        targetType: record.targetType,
      })
      const stored: HistoryEntry = {
        ...parsed,
        targetName: record.targetName,
        timestamp: record.timestamp,
      }
      const filePath = resolveHistoryPath(globalRoot, stored.timestamp)
      await ensureParentDir(filePath)

      return withFileLock(filePath, async () => {
        await writeFile(filePath, `${JSON.stringify(stored, null, 2)}\n`, 'utf8')
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
            const content = await readFile(`${dirPath}/${fileName}`, 'utf8')
            return JSON.parse(content) as HistoryEntry
          }),
        )

        return records.map((record) => ({
          ...historySchema.parse({
            action: record.action,
            targetType: record.targetType,
          }),
          targetName: record.targetName,
          timestamp: record.timestamp,
        }))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return []
        }

        throw error
      }
    },
  }
}
