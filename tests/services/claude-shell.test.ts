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
  it('reads all four settings files with correct priority order', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'cc-env-home-'))
    const cwd = await mkdtemp(join(tmpdir(), 'cc-env-cwd-'))
    roots.push(homeDir, cwd)

    await mkdir(join(homeDir, '.claude'), { recursive: true })
    await writeFile(
      join(homeDir, '.claude', 'settings.json'),
      '{"env":{"KEY_A":"global-settings","KEY_B":"global-only"}}\n',
      'utf8',
    )
    await writeFile(
      join(homeDir, '.claude', 'settings.local.json'),
      '{"env":{"KEY_A":"global-local","KEY_C":"global-local-only"}}\n',
      'utf8',
    )

    await mkdir(join(cwd, '.claude'), { recursive: true })
    await writeFile(
      join(cwd, '.claude', 'settings.json'),
      '{"env":{"KEY_A":"project-settings","KEY_D":"project-only"}}\n',
      'utf8',
    )
    await writeFile(
      join(cwd, '.claude', 'settings.local.json'),
      '{"env":{"KEY_A":"project-local","KEY_E":"project-local-only"}}\n',
      'utf8',
    )

    const service = createClaudeSettingsEnvService({ homeDir, cwd })
    const sources = await service.read()

    expect(sources).toHaveLength(4)
    expect(sources[0]).toMatchObject({
      exists: true,
      env: { KEY_A: 'global-settings', KEY_B: 'global-only' },
    })
    expect(sources[1]).toMatchObject({
      exists: true,
      env: { KEY_A: 'global-local', KEY_C: 'global-local-only' },
    })
    expect(sources[2]).toMatchObject({
      exists: true,
      env: { KEY_A: 'project-settings', KEY_D: 'project-only' },
    })
    expect(sources[3]).toMatchObject({
      exists: true,
      env: { KEY_A: 'project-local', KEY_E: 'project-local-only' },
    })
  })

  it('handles missing files gracefully', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'cc-env-home-'))
    const cwd = await mkdtemp(join(tmpdir(), 'cc-env-cwd-'))
    roots.push(homeDir, cwd)

    await mkdir(join(homeDir, '.claude'), { recursive: true })
    await writeFile(
      join(homeDir, '.claude', 'settings.json'),
      '{"env":{"KEY_A":"global-settings"}}\n',
      'utf8',
    )

    const service = createClaudeSettingsEnvService({ homeDir, cwd })
    const sources = await service.read()

    expect(sources).toHaveLength(4)
    expect(sources[0]!.exists).toBe(true)
    expect(sources[1]!.exists).toBe(false)
    expect(sources[2]!.exists).toBe(false)
    expect(sources[3]!.exists).toBe(false)
  })

  it('throws when settings file contains invalid json', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'cc-env-home-'))
    roots.push(homeDir)

    await mkdir(join(homeDir, '.claude'), { recursive: true })
    await writeFile(join(homeDir, '.claude', 'settings.json'), '{not-json}\n', 'utf8')

    const service = createClaudeSettingsEnvService({ homeDir })
    await expect(service.read()).rejects.toThrow()
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

    const sources = await service.read()
    await service.write(sources.map((s) => ({ path: s.path, env: {} })))

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

  it('collapses blank lines when removing all keys', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'cc-env-shell-'))
    roots.push(homeDir)

    const service = createShellEnvService({ homeDir })
    const shellWrites = await service.write({ API_KEY: 'secret' })

    await service.removeKeys(shellWrites, ['API_KEY'])

    const content = await readFile(join(homeDir, '.zshrc'), 'utf8')
    expect(content).not.toMatch(/\n{3,}/)
  })
})
