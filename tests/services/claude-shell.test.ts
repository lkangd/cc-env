import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { createClaudeSettingsEnvService } from '../../src/services/claude-settings-env-service.js'
import { createShellEnvService } from '../../src/services/shell-env-service.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('Claude settings env service', () => {
  it('reads both settings files and keeps them separate', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'cc-env-home-'))
    roots.push(homeDir)

    await mkdir(join(homeDir, '.claude'), { recursive: true })
    await writeFile(
      join(homeDir, '.claude', 'settings.json'),
      '{"env":{"ANTHROPIC_BASE_URL":"https://settings.example.com"}}\n',
      'utf8',
    )
    await writeFile(
      join(homeDir, '.claude', 'settings.local.json'),
      '{"env":{"ANTHROPIC_AUTH_TOKEN":"local-token"}}\n',
      'utf8',
    )

    const service = createClaudeSettingsEnvService({ homeDir })

    await expect(service.read()).resolves.toMatchObject({
      settings: {
        exists: true,
        env: {
          ANTHROPIC_BASE_URL: 'https://settings.example.com',
        },
      },
      settingsLocal: {
        exists: true,
        env: {
          ANTHROPIC_AUTH_TOKEN: 'local-token',
        },
      },
    })
  })

  it('preserves sibling fields when writing updated env values', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'cc-env-home-'))
    roots.push(homeDir)

    await mkdir(join(homeDir, '.claude'), { recursive: true })
    await writeFile(
      join(homeDir, '.claude', 'settings.json'),
      `${JSON.stringify({
        theme: 'dark',
        env: {
          ANTHROPIC_BASE_URL: 'https://settings.example.com',
        },
      }, null, 2)}\n`,
      'utf8',
    )
    await writeFile(
      join(homeDir, '.claude', 'settings.local.json'),
      `${JSON.stringify({
        permissions: { allow: ['Bash'] },
        env: {
          ANTHROPIC_AUTH_TOKEN: 'local-token',
        },
      }, null, 2)}\n`,
      'utf8',
    )

    const service = createClaudeSettingsEnvService({ homeDir })

    await service.write({
      settingsEnv: {},
      settingsLocalEnv: {},
    })

    await expect(readFile(join(homeDir, '.claude', 'settings.json'), 'utf8')).resolves.toContain(
      '"theme": "dark"',
    )
    await expect(readFile(join(homeDir, '.claude', 'settings.local.json'), 'utf8')).resolves.toContain(
      '"permissions"',
    )
  })
})

describe('shell env service', () => {
  it('writes and updates only the managed block in all shell files', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'cc-env-shell-'))
    roots.push(homeDir)

    await writeFile(join(homeDir, '.zshrc'), 'export PATH="/bin"\n', 'utf8')

    const service = createShellEnvService({ homeDir })

    await service.write({
      ANTHROPIC_AUTH_TOKEN: 'local-token',
    })

    await expect(readFile(join(homeDir, '.zshrc'), 'utf8')).resolves.toContain(
      '# >>> cc-env >>>',
    )
    await expect(readFile(join(homeDir, '.zshrc'), 'utf8')).resolves.toContain(
      'export ANTHROPIC_AUTH_TOKEN="local-token"',
    )
  })

  it('removes only the requested keys from a managed block and leaves user content intact', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'cc-env-shell-'))
    roots.push(homeDir)

    const service = createShellEnvService({ homeDir })
    const shellWrites = await service.write({
      ANTHROPIC_AUTH_TOKEN: 'local-token',
      ANTHROPIC_BASE_URL: 'https://local.example.com',
    })

    await service.removeKeys(shellWrites, ['ANTHROPIC_AUTH_TOKEN'])

    await expect(readFile(join(homeDir, '.bashrc'), 'utf8')).resolves.not.toContain(
      'ANTHROPIC_AUTH_TOKEN',
    )
    await expect(readFile(join(homeDir, '.bashrc'), 'utf8')).resolves.toContain(
      'ANTHROPIC_BASE_URL',
    )
  })
})
