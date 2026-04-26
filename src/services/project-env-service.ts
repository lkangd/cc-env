import { access, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { parse, stringify } from 'yaml'

import { atomicWriteFile } from '../core/fs.js'
import { CliError } from '../core/errors.js'
import { envMapSchema, type EnvMap } from '../core/schema.js'

export type ProjectEnvMeta = {
  name?: string
  createdAt?: string
  updatedAt?: string
}

function parseEnvelope(value: unknown): {
  env: EnvMap
  name?: string | undefined
  createdAt?: string | undefined
  updatedAt?: string | undefined
} {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    if (obj.env && typeof obj.env === 'object' && !Array.isArray(obj.env)) {
      return {
        env: envMapSchema.parse(obj.env),
        name: typeof obj.name === 'string' ? obj.name : undefined,
        createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : undefined,
        updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : undefined,
      }
    }
  }
  return { env: envMapSchema.parse(value) }
}

export function createProjectEnvService({ cwd }: { cwd: string }) {
  const envDir = join(cwd, '.cc-env')
  const jsonPath = join(envDir, 'env.json')
  const yamlPath = join(envDir, 'env.yaml')

  async function exists(filePath: string): Promise<boolean> {
    try {
      await access(filePath)
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false
      }

      throw error
    }
  }

  async function resolveMode(): Promise<'json' | 'yaml' | 'missing'> {
    const [jsonExists, yamlExists] = await Promise.all([exists(jsonPath), exists(yamlPath)])

    if (jsonExists && yamlExists) {
      throw new CliError('Project env conflict: env.json and env.yaml both exist')
    }

    if (yamlExists) {
      return 'yaml'
    }

    if (jsonExists) {
      return 'json'
    }

    return 'missing'
  }

  async function readRaw(): Promise<{
    env: EnvMap
    name?: string | undefined
    createdAt?: string | undefined
    updatedAt?: string | undefined
  }> {
    const mode = await resolveMode()

    if (mode === 'missing') {
      return { env: envMapSchema.parse({}) }
    }

    const filePath = mode === 'yaml' ? yamlPath : jsonPath
    const content = await readFile(filePath, 'utf8')
    const value = mode === 'yaml' ? parse(content) : JSON.parse(content)
    return parseEnvelope(value ?? {})
  }

  return {
    async read(): Promise<EnvMap> {
      const { env } = await readRaw()
      return env
    },

    async readWithMeta(): Promise<{
      env: EnvMap
      name?: string | undefined
      createdAt?: string | undefined
      updatedAt?: string | undefined
    }> {
      return readRaw()
    },

    async write(env: EnvMap, meta?: ProjectEnvMeta): Promise<EnvMap> {
      const parsedEnv = envMapSchema.parse(env)
      await mkdir(envDir, { recursive: true })
      const mode = await resolveMode()

      if (meta?.name !== undefined) {
        const envelope: Record<string, unknown> = { name: meta.name, env: parsedEnv }
        if (meta.createdAt !== undefined) envelope.createdAt = meta.createdAt
        if (meta.updatedAt !== undefined) envelope.updatedAt = meta.updatedAt
        const content = `${JSON.stringify(envelope, null, 2)}\n`
        await atomicWriteFile(jsonPath, content)
        return parsedEnv
      }

      const filePath = mode === 'yaml' ? yamlPath : jsonPath
      const content = mode === 'yaml'
        ? stringify(parsedEnv)
        : `${JSON.stringify(parsedEnv, null, 2)}\n`

      await atomicWriteFile(filePath, content)
      return parsedEnv
    },
  }
}
