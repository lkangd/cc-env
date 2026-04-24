import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { parse, stringify } from 'yaml'

import { CliError } from '../core/errors.js'
import { atomicWriteFile } from '../core/fs.js'
import { withFileLock } from '../core/lock.js'
import { envMapSchema, type EnvMap } from '../core/schema.js'

export function createProjectEnvService({ cwd }: { cwd: string }) {
  const jsonPath = join(cwd, '.cc-env', 'env.json')
  const yamlPath = join(cwd, '.cc-env', 'env.yaml')

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
      const mode = await resolveMode()
      const filePath = mode === 'yaml' ? yamlPath : jsonPath

      return withFileLock(filePath, async () => {
        const content = mode === 'yaml'
          ? stringify(parsedEnv)
          : `${JSON.stringify(parsedEnv, null, 2)}\n`

        await atomicWriteFile(filePath, content)
        return parsedEnv
      })
    },
  }
}
