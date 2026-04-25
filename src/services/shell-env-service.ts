import { readFile } from 'node:fs/promises'

import { atomicWriteFile } from '../core/fs.js'
import { resolveShellConfigPaths } from '../core/paths.js'
import { envMapSchema, type EnvMap } from '../core/schema.js'

const startMarker = '# >>> cc-env >>>'
const endMarker = '# <<< cc-env <<<'

type ShellName = 'zsh' | 'bash' | 'fish'

export type ShellWriteRecord = {
  shell: ShellName
  filePath: string
  env: EnvMap
}

function parseManagedEnv(content: string): EnvMap {
  const match = content.match(/# >>> cc-env >>>[\s\S]*?# <<< cc-env <<</)
  if (!match) {
    return envMapSchema.parse({})
  }

  const lines = match[0]
    .split('\n')
    .slice(1, -1)
    .filter(Boolean)

  return envMapSchema.parse(
    Object.fromEntries(
      lines.map((line) => {
        if (line.startsWith('set -gx ')) {
          const [, key, value] = line.match(/^set -gx ([A-Z0-9_]+) "(.*)"$/) ?? []
          return [key, value]
        }

        const [, key, value] = line.match(/^export ([A-Z0-9_]+)="(.*)"$/) ?? []
        return [key, value]
      }),
    ),
  )
}

function renderBlock(shell: ShellName, env: EnvMap): string {
  const lines = Object.entries(env)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) =>
      shell === 'fish' ? `set -gx ${key} "${value}"` : `export ${key}="${value}"`,
    )

  return [startMarker, ...lines, endMarker, ''].join('\n')
}

function replaceManagedBlock(content: string, block: string): string {
  const pattern = /# >>> cc-env >>>[\s\S]*?# <<< cc-env <<<\n?/
  if (pattern.test(content)) {
    return content.replace(pattern, block)
  }

  return content.length === 0 ? block : `${content.replace(/\n?$/, '\n')}\n${block}`
}

export function createShellEnvService({ homeDir }: { homeDir?: string } = {}) {
  const paths = resolveShellConfigPaths(homeDir)

  async function readContent(path: string): Promise<string> {
    try {
      return await readFile(path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return ''
      }

      throw error
    }
  }

  return {
    async write(env: EnvMap): Promise<ShellWriteRecord[]> {
      return Promise.all(
        (Object.entries(paths) as Array<[ShellName, string]>).map(async ([shell, filePath]) => {
          const content = await readContent(filePath)
          const mergedEnv = envMapSchema.parse({
            ...parseManagedEnv(content),
            ...env,
          })
          await atomicWriteFile(filePath, replaceManagedBlock(content, renderBlock(shell, mergedEnv)))
          return { shell, filePath, env: mergedEnv }
        }),
      )
    },
    async removeKeys(shellWrites: ShellWriteRecord[], keys: string[]): Promise<void> {
      await Promise.all(
        shellWrites.map(async ({ shell, filePath }) => {
          const content = await readContent(filePath)
          const current = parseManagedEnv(content)
          const next = envMapSchema.parse(
            Object.fromEntries(
              Object.entries(current).filter(([key]) => !keys.includes(key)),
            ),
          )
          const block = Object.keys(next).length === 0 ? '' : renderBlock(shell, next)
          await atomicWriteFile(filePath, replaceManagedBlock(content, block))
        }),
      )
    },
  }
}
