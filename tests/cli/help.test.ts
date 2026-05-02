import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const tsxLoader = join(repoRoot, 'node_modules/tsx/dist/loader.mjs')
const cliEntry = join(repoRoot, 'src/cli.ts')

const tempRoots: string[] = []

async function createCliFixture({
  withGlobalPreset = true,
  withProjectPreset = true,
}: {
  withGlobalPreset?: boolean
  withProjectPreset?: boolean
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'cc-env-cli-'))
  tempRoots.push(root)

  const homeDir = join(root, 'home')
  const projectDir = join(root, 'project')
  const binDir = join(root, 'bin')

  await mkdir(join(homeDir, '.cc-env', 'presets'), { recursive: true })
  await mkdir(join(projectDir, '.cc-env'), { recursive: true })
  await mkdir(binDir, { recursive: true })

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

  if (withGlobalPreset) {
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
  }

  await writeFile(
    join(projectDir, 'settings.json'),
    `${JSON.stringify({
      env: {
        SETTINGS_KEY: 'settings',
      },
    }, null, 2)}\n`,
    'utf8',
  )

  if (withProjectPreset) {
    await writeFile(
      join(projectDir, '.cc-env', 'env.json'),
      `${JSON.stringify({ PROJECT_KEY: 'project' }, null, 2)}\n`,
      'utf8',
    )
  }

  const claudePath = join(binDir, 'claude')
  await writeFile(
    claudePath,
    '#!/bin/sh\nprintf "CLAUDE_ARGS:%s\\n" "$*"\nexit 0\n',
    'utf8',
  )
  await chmod(claudePath, 0o755)

  return { homeDir, projectDir, binDir }
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
    expect(stdout).not.toContain('init')
    expect(stdout).toContain('restore')
    expect(stdout).toContain('show')
    expect(stdout).not.toContain('delete')
    expect(stdout).toContain('create')
    expect(stdout).toContain('doctor')
    expect(stdout).not.toContain('edit')
    expect(stdout).not.toContain('rename')
    expect(stdout).toContain('completion')
  })

  it('shows global options in --help output', async () => {
    const { stdout } = await execa('node', ['--import', tsxLoader, cliEntry, '--help'], {
      cwd: repoRoot,
    })

    expect(stdout).toContain('--verbose')
    expect(stdout).toContain('--quiet')
    expect(stdout).toContain('--no-interactive')
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

  it('routes bare cc-env to run when any preset exists', async () => {
    const { homeDir, projectDir, binDir } = await createCliFixture({
      withGlobalPreset: true,
      withProjectPreset: false,
    })

    const result = await execa(
      'node',
      ['--import', tsxLoader, cliEntry],
      {
        cwd: projectDir,
        env: {
          HOME: homeDir,
          PATH: `${binDir}:${process.env.PATH ?? ''}`,
        },
        input: '\n',
        reject: false,
      },
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Using preset: openai (global)')
  })

  it('shows help for bare cc-env when no preset exists', async () => {
    const { homeDir, projectDir } = await createCliFixture({
      withGlobalPreset: false,
      withProjectPreset: false,
    })

    const result = await execa(
      'node',
      ['--import', tsxLoader, cliEntry],
      {
        cwd: projectDir,
        env: { HOME: homeDir },
        reject: false,
      },
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Usage: cc-env')
  })

  it('routes top-level claude args through the run flow', async () => {
    const { homeDir, projectDir, binDir } = await createCliFixture({
      withGlobalPreset: true,
      withProjectPreset: false,
    })

    const result = await execa(
      'node',
      ['--import', tsxLoader, cliEntry, 'claude', '--resume', '57df85eb-38fc-4bf5-8eb1-9bfa88acc549'],
      {
        cwd: projectDir,
        env: {
          HOME: homeDir,
          PATH: `${binDir}:${process.env.PATH ?? ''}`,
        },
        input: '\n',
        reject: false,
      },
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Using preset: openai (global)')
    expect(result.stdout).toContain('CLAUDE_ARGS:--resume 57df85eb-38fc-4bf5-8eb1-9bfa88acc549')
    expect(result.stderr).not.toContain('unknown command')
    expect(result.stderr).not.toContain('too many arguments')
  })

  it('matches explicit run claude output', async () => {
    const { homeDir, projectDir, binDir } = await createCliFixture({
      withGlobalPreset: true,
      withProjectPreset: false,
    })

    const implicit = await execa(
      'node',
      ['--import', tsxLoader, cliEntry, 'claude', '--resume', '57df85eb-38fc-4bf5-8eb1-9bfa88acc549'],
      {
        cwd: projectDir,
        env: {
          HOME: homeDir,
          PATH: `${binDir}:${process.env.PATH ?? ''}`,
        },
        input: '\n',
        reject: false,
      },
    )

    const explicit = await execa(
      'node',
      ['--import', tsxLoader, cliEntry, 'run', '--yes', 'claude', '--resume', '57df85eb-38fc-4bf5-8eb1-9bfa88acc549'],
      {
        cwd: projectDir,
        env: {
          HOME: homeDir,
          PATH: `${binDir}:${process.env.PATH ?? ''}`,
        },
        reject: false,
      },
    )

    expect(implicit.exitCode).toBe(0)
    expect(explicit.exitCode).toBe(0)
    expect(implicit.stdout).toBe(explicit.stdout)
    expect(implicit.stderr).toBe(explicit.stderr)
  })

  it('prints CliError messages without stack traces at the top level', async () => {
    const { homeDir, projectDir } = await createCliFixture({
      withGlobalPreset: false,
      withProjectPreset: false,
    })

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

  it('doctor --json outputs valid JSON with check results', async () => {
    const { homeDir, projectDir } = await createCliFixture()

    const result = await execa(
      'node',
      ['--import', tsxLoader, cliEntry, 'doctor', '--json'],
      {
        cwd: projectDir,
        env: { HOME: homeDir },
        reject: false,
      },
    )

    const parsed = JSON.parse(result.stdout)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.every((c: unknown) => typeof c === 'object' && c !== null && 'label' in c && 'ok' in c)).toBe(true)
  })

  it('completion --shell fish outputs fish completion script', async () => {
    const { stdout } = await execa(
      'node',
      ['--import', tsxLoader, cliEntry, 'completion', '--shell', 'fish'],
      { cwd: repoRoot },
    )

    expect(stdout).toContain('complete -c cc-env')
    expect(stdout).toContain('complete -c ccenv')
    expect(stdout).toContain("'doctor'")
  })

  it('completion --shell bash outputs bash completion script', async () => {
    const { stdout } = await execa(
      'node',
      ['--import', tsxLoader, cliEntry, 'completion', '--shell', 'bash'],
      { cwd: repoRoot },
    )

    expect(stdout).toContain('_cc_env_completions')
    expect(stdout).toContain('complete -F _cc_env_completions cc-env')
    expect(stdout).toContain('complete -F _cc_env_completions ccenv')
  })

  it('run --dry-run --json --yes outputs JSON with preset and command', async () => {
    const { homeDir, projectDir } = await createCliFixture()

    const result = await execa(
      'node',
      ['--import', tsxLoader, cliEntry, 'run', '--dry-run', '--json', '--yes', 'claude'],
      {
        cwd: projectDir,
        env: { HOME: homeDir },
        reject: false,
      },
    )

    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.stdout)
    // Project preset takes priority when it exists
    expect(parsed.preset.name).toBeTruthy()
    expect(parsed.preset.source).toMatch(/^(global|project)$/)
    expect(parsed.command).toContain('claude')
    expect(parsed.env).toBeDefined()
  })

  it('show --json outputs JSON array of presets', async () => {
    const { homeDir, projectDir } = await createCliFixture()

    const result = await execa(
      'node',
      ['--import', tsxLoader, cliEntry, 'show', '--json'],
      {
        cwd: projectDir,
        env: { HOME: homeDir },
        reject: false,
      },
    )

    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
    expect(parsed.every((p: unknown) => typeof p === 'object' && p !== null && 'name' in p && 'source' in p)).toBe(true)
  })
})
