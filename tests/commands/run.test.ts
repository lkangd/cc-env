import { rm } from 'node:fs/promises'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRunCommand } from '../../src/commands/run.js'
import { CliError } from '../../src/core/errors.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('createRunCommand', () => {
  it('throws a usage error when no command is provided', async () => {
    const run = createRunCommand({
      configService: {
        read: vi.fn(),
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

    await expect(run({})).rejects.toEqual(new CliError('A command to run is required', 2))
  })

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

  it('quotes spaced dry-run args deterministically', async () => {
    const stdout = {
      write: vi.fn(),
    }
    const run = createRunCommand({
      configService: {
        read: vi.fn().mockResolvedValue({
          defaultPreset: 'openai',
        }),
      },
      presetService: {
        read: vi.fn().mockResolvedValue({
          env: {
            OPENAI_API_KEY: 'sk-1234567890',
          },
        }),
      },
      envSources: vi.fn().mockResolvedValue({
        settingsEnv: {},
        processEnv: {},
        presetEnv: {
          OPENAI_API_KEY: 'sk-1234567890',
        },
        projectEnv: {},
      }),
      runtimeEnvService: {
        merge: vi.fn().mockReturnValue({
          OPENAI_API_KEY: 'sk-1234567890',
        }),
      },
      spawnCommand: vi.fn(),
      stdout,
    })

    await run({
      dryRun: true,
      command: 'node',
      args: ['script.js', 'two words', 'say "hi"'],
    })

    expect(stdout.write).toHaveBeenCalledWith(
      [
        'Would run:',
        'OPENAI_API_KEY=sk-123456********',
        '',
        'node script.js "two words" "say \\"hi\\""',
        '',
      ].join('\n'),
    )
  })
})
