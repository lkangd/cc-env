import { readFile } from 'node:fs/promises'

import { atomicWriteFile } from '../core/fs.js'
import { envMapSchema, type EnvMap } from '../core/schema.js'

export function createSettingsEnvService({ settingsPath }: { settingsPath: string }) {
  return {
    async read(): Promise<EnvMap> {
      try {
        const content = await readFile(settingsPath, 'utf8')
        const json = JSON.parse(content) as { env?: unknown }
        return envMapSchema.parse(json.env ?? {})
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return envMapSchema.parse({})
        }

        throw error
      }
    },

    async write(env: EnvMap): Promise<EnvMap> {
      const parsedEnv = envMapSchema.parse(env)
      let json: Record<string, unknown> = {}

      try {
        const content = await readFile(settingsPath, 'utf8')
        json = JSON.parse(content) as Record<string, unknown>
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }

      json.env = parsedEnv
      await atomicWriteFile(settingsPath, `${JSON.stringify(json, null, 2)}\n`)
      return parsedEnv
    },
  }
}
