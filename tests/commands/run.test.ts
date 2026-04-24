import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { execa } from 'execa'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRunCommand } from '../../src/commands/run.js'
import { CliError } from '../../src/core/errors.js'

const tempDirs: string[] = []

async function createCliFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'cc-env-run-'))
  tempDirs.push(cwd)

  await mkdir(join(cwd, '.cc-env-global', 'presets'), { recursive: true })
  await writeFile(
    join(cwd, '.cc-env-global', 'config.json'),
    `${JSON.stringify({ defaultPreset: 'openai' }, null, 2)}\n`,
  )
  await writeFile(
    join(cwd, '.cc-env-global', 'presets', 'openai.json'),
    `${JSON.stringify({
      name: 'openai',
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
      env: {
        OPENAI_API_KEY: 'sk-1234567890',
      },
    }, null, 2)}\n`,
  )

  return cwd
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('createRunCommand', () => {
  it('throws when neither explicit nor default preset is available', async () => {
    const run = createRunCommand({
      configService: {
        read: vi.fn().mockResolvedValue({}),
      },
      presetService: {
        read: vi.fn(),
      },
      envSources: vi.fn(),
      runtimeEnvService: {
        merge: vi.fn(),
      },
      spawnCommand: vi.fn(),
    })

    await expect(
      run({
        command: 'node',
        args: ['script.js'],
      }),
    ).rejects.toEqual(new CliError('No preset selected'))
  })

  it('supports top-level --dry-run execution through the CLI', async () => {
    const cwd = await createCliFixture()

    const { stdout } = await execa(
      process.execPath,
      [
        '/Users/liangkangda/Fe-project/code/cc-env/.worktrees/cc-env-v1/node_modules/tsx/dist/cli.mjs',
        '/Users/liangkangda/Fe-project/code/cc-env/.worktrees/cc-env-v1/src/cli.ts',
        '--dry-run',
        'node',
        'script.js',
      ],
      {
        cwd,
        extendEnv: false,
        env: {
          HOME: process.env.HOME,
          PATH: process.env.PATH,
          TMPDIR: process.env.TMPDIR,
        },
      },
    )

    expect(stdout).toContain('Would run:')
    expect(stdout).toContain('OPENAI_API_KEY=sk-123456********')
    expect(stdout).toContain('node script.js')
  })

  it('prints a preview during dry-run and does not call spawnCommand', async () => {
    const stdout = {
      write: vi.fn(),
    }
    const spawnCommand = vi.fn()
    const envSources = vi.fn().mockResolvedValue({
      settingsEnv: {},
      processEnv: {},
      presetEnv: {
        OPENAI_API_KEY: 'sk-1234567890',
      },
      projectEnv: {
        BASE_URL: 'https://api.openai.com',
      },
    })
    const merge = vi.fn().mockReturnValue({
      OPENAI_API_KEY: 'sk-1234567890',
      BASE_URL: 'https://api.openai.com',
    })
    const run = createRunCommand({
      configService: {
        read: vi.fn().mockResolvedValue({
          defaultPreset: 'openai',
        }),
      },
      presetService: {
        read: vi.fn().mockResolvedValue({
          name: 'openai',
          env: {
            OPENAI_API_KEY: 'sk-1234567890',
          },
        }),
      },
      envSources,
      runtimeEnvService: {
        merge,
      },
      spawnCommand,
      stdout,
    })

    await run({
      dryRun: true,
      command: 'node',
      args: ['script.js', '--flag'],
    })

    expect(envSources).toHaveBeenCalledWith({
      preset: 'openai',
      presetEnv: {
        OPENAI_API_KEY: 'sk-1234567890',
      },
    })
    expect(merge).toHaveBeenCalledWith({
      settingsEnv: {},
      processEnv: {},
      presetEnv: {
        OPENAI_API_KEY: 'sk-1234567890',
      },
      projectEnv: {
        BASE_URL: 'https://api.openai.com',
      },
    })
    expect(stdout.write).toHaveBeenCalledWith(
      [
        'Would run:',
        'BASE_URL=https://api.openai.com',
        'OPENAI_API_KEY=sk-123456********',
        '',
        'node script.js --flag',
        '',
      ].join('\n'),
    )
    expect(spawnCommand).not.toHaveBeenCalled()
  })
})
