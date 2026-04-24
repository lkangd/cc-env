import { access, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import lockfile from 'proper-lockfile'
import { parse, stringify } from 'yaml'

import { CliError } from '../core/errors.js'
import { atomicWriteFile } from '../core/fs.js'
import { envMapSchema, type EnvMap } from '../core/schema.js'

export function createProjectEnvService({ cwd }: { cwd: string }) {
  const envDir = join(cwd, '.cc-env')
  const jsonPath = join(envDir, 'env.json')
  const yamlPath = join(envDir, 'env.yaml')
  const lockPath = join(envDir, '.env.lock')

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

  async function withProjectEnvLock<T>(run: () => Promise<T>): Promise<T> {
    await mkdir(envDir, { recursive: true })
    await access(lockPath).catch(async (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await atomicWriteFile(lockPath, '')
        return
      }

      throw error
    })

    const release = await lockfile.lock(lockPath, {
      realpath: false,
      retries: {
        retries: 3,
        factor: 1,
      },
    })

    try {
      return await run()
    } finally {
      await release()
    }
  }

  return {
    async read(): Promise<EnvMap> {
      const mode = await resolveMode()

      if (mode === 'missing') {
        return envMapSchema.parse({})
      }

      const filePath = mode === 'yaml' ? yamlPath : jsonPath
      const content = await readFile(filePath, 'utf8')
      const value = mode === 'yaml' ? parse(content) : JSON.parse(content)
      return envMapSchema.parse(value ?? {})
    },

    async write(env: EnvMap): Promise<EnvMap> {
      const parsedEnv = envMapSchema.parse(env)

      return withProjectEnvLock(async () => {
        const mode = await resolveMode()
        const filePath = mode === 'yaml' ? yamlPath : jsonPath
        const content = mode === 'yaml'
          ? stringify(parsedEnv)
          : `${JSON.stringify(parsedEnv, null, 2)}\n`

        await atomicWriteFile(filePath, content)
        return parsedEnv
      })
    },
  }
}
