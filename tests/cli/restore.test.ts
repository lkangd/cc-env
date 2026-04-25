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

async function createRestoreFixture({ latestIncludesExtraKey = false }: { latestIncludesExtraKey?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'cc-env-restore-cli-'))
  tempRoots.push(root)

  const homeDir = join(root, 'home')
  await mkdir(join(homeDir, '.claude'), { recursive: true })
  await mkdir(join(homeDir, '.cc-env', 'history'), { recursive: true })
  await mkdir(join(homeDir, '.config', 'fish'), { recursive: true })

  await writeFile(
    join(homeDir, '.claude', 'settings.json'),
    `${JSON.stringify({ env: {} }, null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    join(homeDir, '.claude', 'settings.local.json'),
    `${JSON.stringify({ env: {} }, null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    join(homeDir, '.config', 'fish', 'config.fish'),
    [
      '# >>> cc-env >>>',
      'set -gx ANTHROPIC_AUTH_TOKEN "local-token"',
      ...(latestIncludesExtraKey ? ['set -gx API_TIMEOUT_MS "3000000"'] : []),
      '# <<< cc-env <<<',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    join(homeDir, '.cc-env', 'history', '2026-04-24T12-00-00.000Z.json'),
    `${JSON.stringify({
      timestamp: '2026-04-24T12:00:00.000Z',
      action: 'init',
      migratedKeys: ['ANTHROPIC_AUTH_TOKEN'],
      sources: [
        {
          file: join(homeDir, '.claude', 'settings.json'),
          backup: {},
        },
        {
          file: join(homeDir, '.claude', 'settings.local.json'),
          backup: {
            ANTHROPIC_AUTH_TOKEN: 'local-token',
          },
        },
      ],
      shellWrites: [
        {
          shell: 'fish',
          filePath: join(homeDir, '.config', 'fish', 'config.fish'),
          env: {
            ANTHROPIC_AUTH_TOKEN: 'local-token',
          },
        },
      ],
    }, null, 2)}\n`,
    'utf8',
  )

  if (latestIncludesExtraKey) {
    await writeFile(
      join(homeDir, '.cc-env', 'history', '2026-04-25T12-00-00.000Z.json'),
      `${JSON.stringify({
        timestamp: '2026-04-25T12:00:00.000Z',
        action: 'init',
        migratedKeys: ['ANTHROPIC_AUTH_TOKEN', 'API_TIMEOUT_MS'],
        sources: [
          {
            file: join(homeDir, '.claude', 'settings.json'),
            backup: {},
          },
          {
            file: join(homeDir, '.claude', 'settings.local.json'),
            backup: {
              ANTHROPIC_AUTH_TOKEN: 'local-token',
              API_TIMEOUT_MS: '3000000',
            },
          },
        ],
        shellWrites: [
          {
            shell: 'fish',
            filePath: join(homeDir, '.config', 'fish', 'config.fish'),
            env: {
              ANTHROPIC_AUTH_TOKEN: 'local-token',
              API_TIMEOUT_MS: '3000000',
            },
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    )
  }

  return { homeDir }
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('cc-env CLI restore', () => {
  it('restores Claude settings from init history with --yes', async () => {
    const { homeDir } = await createRestoreFixture()

    const { stdout } = await execa(
      'node',
      ['--import', tsxLoader, cliEntry, 'restore', '--yes'],
      {
        cwd: repoRoot,
        env: {
          HOME: homeDir,
        },
      },
    )

    const settingsLocal = JSON.parse(
      await readFile(join(homeDir, '.claude', 'settings.local.json'), 'utf8'),
    ) as { env?: Record<string, string> }
    const fishConfig = await readFile(join(homeDir, '.config', 'fish', 'config.fish'), 'utf8')

    expect(stdout).toContain('Restore complete')
    expect(settingsLocal.env).toEqual({
      ANTHROPIC_AUTH_TOKEN: 'local-token',
    })
    expect(fishConfig).not.toContain('ANTHROPIC_AUTH_TOKEN')
  })

  it('restores the latest init record with extra migrated keys when using --yes', async () => {
    const { homeDir } = await createRestoreFixture({ latestIncludesExtraKey: true })

    await execa(
      'node',
      ['--import', tsxLoader, cliEntry, 'restore', '--yes'],
      {
        cwd: repoRoot,
        env: {
          HOME: homeDir,
        },
      },
    )

    const settingsLocal = JSON.parse(
      await readFile(join(homeDir, '.claude', 'settings.local.json'), 'utf8'),
    ) as { env?: Record<string, string> }
    const fishConfig = await readFile(join(homeDir, '.config', 'fish', 'config.fish'), 'utf8')

    expect(settingsLocal.env).toEqual({
      ANTHROPIC_AUTH_TOKEN: 'local-token',
      API_TIMEOUT_MS: '3000000',
    })
    expect(fishConfig).not.toContain('ANTHROPIC_AUTH_TOKEN')
    expect(fishConfig).not.toContain('API_TIMEOUT_MS')
    expect(fishConfig).not.toContain('# >>> cc-env >>>')
  })
})
