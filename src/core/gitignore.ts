import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export function isGitRepo(dir: string): boolean {
  return existsSync(join(dir, '.git'))
}

export async function ensureGitignoreEntry(dir: string, entry: string): Promise<void> {
  if (!isGitRepo(dir)) return

  const gitignorePath = join(dir, '.gitignore')
  let content = ''

  try {
    content = await readFile(gitignorePath, 'utf8')
  } catch {
    // .gitignore doesn't exist — will create it
  }

  const lines = content.split('\n')
  if (lines.some((line) => line === entry || line === `${entry}/`)) return

  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : ''
  await writeFile(gitignorePath, `${content}${separator}${entry}\n`, 'utf8')
}
