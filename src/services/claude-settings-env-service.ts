import { readFile } from 'node:fs/promises'

import { atomicWriteFile } from '../core/fs.js'
import {
  resolveClaudeSettingsLocalPath,
  resolveClaudeSettingsPath,
  resolveProjectSettingsLocalPath,
  resolveProjectSettingsPath,
} from '../core/paths.js'
import { envMapSchema, type EnvMap } from '../core/schema.js'

export type ClaudeSettingsSource = {
  path: string
  exists: boolean
  env: EnvMap
}

export function createClaudeSettingsEnvService({ homeDir, cwd }: { homeDir?: string; cwd?: string } = {}) {
  const paths = [
    resolveClaudeSettingsPath(homeDir),
    resolveClaudeSettingsLocalPath(homeDir),
    resolveProjectSettingsPath(cwd),
    resolveProjectSettingsLocalPath(cwd),
  ]

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
    read: () => Promise.all(paths.map(readOne)),
    write: async (sources: Array<{ path: string; env: EnvMap }>) => {
      for (const { path, env } of sources) {
        await writeOne(path, env)
      }
    },
  }
}
