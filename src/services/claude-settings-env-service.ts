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

  async function writeOne(path: string, env: EnvMap): Promise<void> {
    let json: Record<string, unknown> = {}

    try {
      const content = await readFile(path, 'utf8')
      json = JSON.parse(content) as Record<string, unknown>
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }

    json.env = envMapSchema.parse(env)
    await atomicWriteFile(path, `${JSON.stringify(json, null, 2)}\n`)
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
      await writeOne(settingsPath, settingsEnv)
      await writeOne(settingsLocalPath, settingsLocalEnv)
    },
  }
}
