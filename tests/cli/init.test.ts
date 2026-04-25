import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const tsxLoader = join(repoRoot, 'node_modules/tsx/dist/loader.mjs')
const cliEntry = join(repoRoot, 'src/cli.ts')

const tempRoots: string[] = []

async function createInitFixture() {
  const root = await mkdtemp(join(tmpdir(), 'cc-env-init-cli-'))
  tempRoots.push(root)

  const homeDir = join(root, 'home')
  await mkdir(join(homeDir, '.claude'), { recursive: true })

  await writeFile(
    join(homeDir, '.claude', 'settings.json'),
    `${JSON.stringify({
      env: {
        ANTHROPIC_BASE_URL: 'https://settings.example.com',
      },
    }, null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    join(homeDir, '.claude', 'settings.local.json'),
    `${JSON.stringify({
      env: {
        ANTHROPIC_AUTH_TOKEN: 'local-token',
      },
    }, null, 2)}\n`,
    'utf8',
  )

  return { homeDir }
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('cc-env CLI init', () => {
  it('migrates env into shell config with --yes', async () => {
    const { homeDir } = await createInitFixture()

    await execa(
      'node',
      ['--import', tsxLoader, cliEntry, 'init', '--yes'],
      {
        cwd: repoRoot,
        env: {
          HOME: homeDir,
        },
      },
    )

    const settings = JSON.parse(
      await readFile(join(homeDir, '.claude', 'settings.json'), 'utf8'),
    ) as { env?: Record<string, string> }
    const settingsLocal = JSON.parse(
      await readFile(join(homeDir, '.claude', 'settings.local.json'), 'utf8'),
    ) as { env?: Record<string, string> }
    const fishConfig = await readFile(join(homeDir, '.config', 'fish', 'config.fish'), 'utf8')

    expect(settings.env).toEqual({})
    expect(settingsLocal.env).toEqual({})
    expect(fishConfig).toContain('set -gx ANTHROPIC_AUTH_TOKEN "local-token"')
    expect(fishConfig).toContain('set -gx ANTHROPIC_BASE_URL "https://settings.example.com"')
  })
})
