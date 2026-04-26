import { readFile } from 'node:fs/promises'

import { configSchema, type Config } from '../core/schema.js'
import { atomicWriteFile } from '../core/fs.js'
import { resolveConfigPath } from '../core/paths.js'

export function createConfigService(globalRoot: string) {
  const filePath = resolveConfigPath(globalRoot)

  return {
    async read(): Promise<Config> {
      try {
        const content = await readFile(filePath, 'utf8')
        return configSchema.parse(JSON.parse(content))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return configSchema.parse({})
        }

        throw error
      }
    },

    async write(config: Config): Promise<Config> {
      const parsed = configSchema.parse(config)
      await atomicWriteFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`)
      return parsed
    },
  }
}
