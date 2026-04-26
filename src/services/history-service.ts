import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { atomicWriteFile, ensureParentDir } from '../core/fs.js'
import { resolveHistoryPath } from '../core/paths.js'
import { historySchema } from '../core/schema.js'
import type { HistoryRecord } from '../core/schema.js'

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

export function createHistoryService(globalRoot: string) {
  return {
    async write(record: HistoryRecord): Promise<HistoryRecord> {
      const stored = historySchema.parse(record)
      const filePath = resolveHistoryPath(globalRoot, stored.timestamp)
      await ensureParentDir(filePath)
      await atomicWriteFile(filePath, `${JSON.stringify(stored, null, 2)}\n`)
      return stored
    },

    async list(): Promise<HistoryRecord[]> {
      const dirPath = dirname(resolveHistoryPath(globalRoot, 'placeholder'))

      try {
        const entries = await readdir(dirPath, { withFileTypes: true })
        const fileNames = entries
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map((entry) => entry.name)
          .sort((a, b) => b.localeCompare(a))

        return Promise.all(
          fileNames.map(async (fileName) => {
            const content = await readFile(join(dirPath, fileName), 'utf8')
            return historySchema.parse(JSON.parse(content))
          }),
        )
      } catch (error) {
        if (isErrnoException(error) && error.code === 'ENOENT') {
          return []
        }

        throw error
      }
    },
  }
}
