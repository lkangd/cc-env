import { readFile } from 'node:fs/promises'

import { atomicWriteFile } from '../core/fs.js'
import {
  resolveClaudeSettingsLocalPath,
  resolveClaudeSettingsPath,
} from '../core/paths.js'
import { envMapSchema, type EnvMap } from '../core/schema.js'

type ClaudeSettingsSource = {
  path: string
  exists: boolean
  env: EnvMap
}

export function createClaudeSettingsEnvService({ homeDir }: { homeDir?: string } = {}) {
  const settingsPath = resolveClaudeSettingsPath(homeDir)
  const settingsLocalPath = resolveClaudeSettingsLocalPath(homeDir)

  async function readOne(path: string): Promise<ClaudeSettingsSource> {
    try {
      const content = await readFile(path, 'utf8')
      const json = JSON.parse(content) as { env?: unknown }
      return {
        path,
        exists: true,
        env: envMapSchema.parse(json.env ?? {}),
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          path,
          exists: false,
          env: envMapSchema.parse({}),
        }
      }

      throw error
    }
  }

  return {
    read: async () => ({
      settings: await readOne(settingsPath),
      settingsLocal: await readOne(settingsLocalPath),
    }),
    write: async ({
      settingsEnv,
      settingsLocalEnv,
    }: {
      settingsEnv: EnvMap
      settingsLocalEnv: EnvMap
    }) => {
      await atomicWriteFile(
        settingsPath,
        `${JSON.stringify({ env: envMapSchema.parse(settingsEnv) }, null, 2)}\n`,
      )
      await atomicWriteFile(
        settingsLocalPath,
        `${JSON.stringify({ env: envMapSchema.parse(settingsLocalEnv) }, null, 2)}\n`,
      )
    },
  }
}
