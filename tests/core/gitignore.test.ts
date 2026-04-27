import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ensureGitignoreEntry, isGitRepo } from '../../src/core/gitignore.js'

const tempRoots: string[] = []

async function createTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'cc-env-git-'))
  tempRoots.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('isGitRepo', () => {
  it('returns true when .git exists', async () => {
    const dir = await createTempDir()
    await mkdir(join(dir, '.git'))

    expect(isGitRepo(dir)).toBe(true)
  })

  it('returns false when .git is missing', async () => {
    const dir = await createTempDir()

    expect(isGitRepo(dir)).toBe(false)
  })
})

describe('ensureGitignoreEntry', () => {
  it('creates .gitignore if missing', async () => {
    const dir = await createTempDir()
    await mkdir(join(dir, '.git'))

    await ensureGitignoreEntry(dir, '.cc-env')

    const content = await readFile(join(dir, '.gitignore'), 'utf8')
    expect(content).toBe('.cc-env\n')
  })

  it('appends entry to existing .gitignore', async () => {
    const dir = await createTempDir()
    await mkdir(join(dir, '.git'))
    await writeFile(join(dir, '.gitignore'), 'node_modules\n', 'utf8')

    await ensureGitignoreEntry(dir, '.cc-env')

    const content = await readFile(join(dir, '.gitignore'), 'utf8')
    expect(content).toBe('node_modules\n.cc-env\n')
  })

  it('skips if entry already present', async () => {
    const dir = await createTempDir()
    await mkdir(join(dir, '.git'))
    await writeFile(join(dir, '.gitignore'), 'node_modules\n.cc-env\n', 'utf8')

    await ensureGitignoreEntry(dir, '.cc-env')

    const content = await readFile(join(dir, '.gitignore'), 'utf8')
    expect(content).toBe('node_modules\n.cc-env\n')
  })

  it('skips if entry with trailing slash present', async () => {
    const dir = await createTempDir()
    await mkdir(join(dir, '.git'))
    await writeFile(join(dir, '.gitignore'), '.cc-env/\n', 'utf8')

    await ensureGitignoreEntry(dir, '.cc-env')

    const content = await readFile(join(dir, '.gitignore'), 'utf8')
    expect(content).toBe('.cc-env/\n')
  })

  it('does nothing outside git repo', async () => {
    const dir = await createTempDir()

    await ensureGitignoreEntry(dir, '.cc-env')

    await expect(readFile(join(dir, '.gitignore'), 'utf8')).rejects.toThrow()
  })

  it('handles .gitignore without trailing newline', async () => {
    const dir = await createTempDir()
    await mkdir(join(dir, '.git'))
    await writeFile(join(dir, '.gitignore'), 'node_modules', 'utf8')

    await ensureGitignoreEntry(dir, '.cc-env')

    const content = await readFile(join(dir, '.gitignore'), 'utf8')
    expect(content).toBe('node_modules\n.cc-env\n')
  })
})
