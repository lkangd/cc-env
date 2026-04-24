import { readdir, readFile, rm, writeFile } from 'node:fs/promises'

import { CliError } from '../core/errors.js'
import { ensureParentDir } from '../core/fs.js'
import { withFileLock } from '../core/lock.js'
import { resolvePresetPath } from '../core/paths.js'
import { presetSchema, type Preset } from '../core/schema.js'

type StoredPreset = Preset & { filePath: string }

export function createPresetService(globalRoot: string) {
  function getPath(name: string): string {
    return resolvePresetPath(globalRoot, name)
  }

  return {
    getPath,

    async write(preset: Preset): Promise<StoredPreset> {
      const parsed = presetSchema.parse(preset)
      const filePath = getPath(parsed.name)
      await ensureParentDir(filePath)

      return withFileLock(filePath, async () => {
        await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
        return { ...parsed, filePath }
      })
    },

    async read(name: string): Promise<StoredPreset> {
      const filePath = getPath(name)

      try {
        const content = await readFile(filePath, 'utf8')
        const preset = presetSchema.parse(JSON.parse(content))
        return { ...preset, filePath }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new CliError(`Preset not found: ${name}`)
        }

        throw error
      }
    },

    async listNames(): Promise<string[]> {
      const dirPath = getPath('placeholder').replace(/\/placeholder\.json$/, '')

      try {
        const entries = await readdir(dirPath, { withFileTypes: true })
        return entries
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map((entry) => entry.name.slice(0, -'.json'.length))
          .sort()
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return []
        }

        throw error
      }
    },

    async remove(name: string): Promise<void> {
      const filePath = getPath(name)

      try {
        await rm(filePath)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }
    },
  }
}
