import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const tsxLoader = join(repoRoot, 'node_modules/tsx/dist/loader.mjs')
const cliEntry = join(repoRoot, 'src/cli.ts')

const tempRoots: string[] = []

async function createCliFixture() {
  const root = await mkdtemp(join(tmpdir(), 'cc-env-cli-'))
  tempRoots.push(root)

  const homeDir = join(root, 'home')
  const projectDir = join(root, 'project')

  await mkdir(join(homeDir, '.cc-env', 'presets'), { recursive: true })
  await mkdir(join(projectDir, '.cc-env'), { recursive: true })

  await writeFile(
    join(homeDir, '.cc-env', 'config.json'),
    `${JSON.stringify({ defaultPreset: 'openai' }, null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    join(homeDir, '.cc-env', 'project-state.json'),
    `${JSON.stringify({}, null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    join(homeDir, '.cc-env', 'presets', 'openai.json'),
    `${JSON.stringify({
      name: 'openai',
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
      env: {
        PRESET_KEY: 'preset',
      },
    }, null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    join(projectDir, 'settings.json'),
    `${JSON.stringify({
      env: {
        SETTINGS_KEY: 'settings',
      },
    }, null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    join(projectDir, '.cc-env', 'env.json'),
    `${JSON.stringify({ PROJECT_KEY: 'project' }, null, 2)}\n`,
    'utf8',
  )

  return { homeDir, projectDir }
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('cc-env CLI help', () => {
  it('shows the top-level commands in --help output', async () => {
    const { stdout } = await execa('node', ['--import', tsxLoader, cliEntry, '--help'], {
      cwd: repoRoot,
    })

    expect(stdout).toContain('run')
    expect(stdout).toContain('init')
    expect(stdout).toContain('restore')
    expect(stdout).toContain('preset')
  })

  it('shows the preset subcommands in help output', async () => {
    const { stdout } = await execa('node', ['--import', tsxLoader, cliEntry, 'preset', '--help'], {
      cwd: repoRoot,
    })

    expect(stdout).toContain('show')
    expect(stdout).toContain('delete')
  })

  it('uses real HOME and cwd wiring for dry-run env resolution', async () => {
    const { homeDir, projectDir } = await createCliFixture()
    const result = await execa(
      'node',
      ['--import', tsxLoader, cliEntry, 'run', '--dry-run', '--yes', 'claude'],
      {
        cwd: projectDir,
        env: {
          HOME: homeDir,
        },
        reject: false,
      },
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('PROJECT_KEY=')
    expect(result.stdout).toContain('Would run: claude')
  })

  it('prints CliError messages without stack traces at the top level', async () => {
    const { homeDir, projectDir } = await createCliFixture()

    await mkdir(join(projectDir, '.claude'), { recursive: true })
    await writeFile(
      join(projectDir, '.claude', 'settings.json'),
      `${JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: 'stale' } }, null, 2)}\n`,
      'utf8',
    )

    const result = await execa(
      'node',
      ['--import', tsxLoader, cliEntry, 'run', '--dry-run', '--yes'],
      {
        cwd: projectDir,
        env: { HOME: homeDir },
        reject: false,
      },
    )

    expect(result.exitCode).toBe(1)
    expect(result.stderr).not.toContain('CliError:')
    expect(result.stderr).toContain('Error:')
  })
})
