import { afterEach, describe, expect, it, vi } from 'vitest'

const execSyncMock = vi.fn()
const existsSyncMock = vi.fn()
const readFileSyncMock = vi.fn()
const realpathSyncMock = vi.fn()

vi.mock('node:child_process', () => ({
  execSync: execSyncMock,
}))

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
  readFileSync: readFileSyncMock,
  realpathSync: realpathSyncMock,
}))

describe('findClaudeExecutable', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('resolves aliased which output', async () => {
    execSyncMock.mockReturnValue('claude: aliased to /usr/local/bin/claude\n')
    realpathSyncMock.mockReturnValue('/usr/local/bin/claude')
    existsSyncMock.mockReturnValue(true)
    readFileSyncMock.mockReturnValue('#!/usr/bin/env node\n')

    const { findClaudeExecutable } = await import('../../src/core/find-claude.js')
    expect(findClaudeExecutable()).toBe('/usr/local/bin/claude')
  })

  it('reads bash wrapper exec target', async () => {
    execSyncMock.mockReturnValue('/usr/local/bin/claude\n')
    realpathSyncMock.mockImplementation((p: string) => p)
    existsSyncMock.mockReturnValue(true)
    readFileSyncMock.mockReturnValue('#!/bin/bash\nexec "/opt/claude/bin/claude.js"\n')

    const { findClaudeExecutable } = await import('../../src/core/find-claude.js')
    expect(findClaudeExecutable()).toBe('/opt/claude/bin/claude.js')
  })

  it('falls back to ~/.claude/local/claude wrapper', async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('which: command not found')
    })
    existsSyncMock.mockImplementation((path: string) => {
      return path.includes('.claude/local/claude')
    })
    readFileSyncMock.mockReturnValue('#!/bin/bash\nexec "/home/user/.claude/local/node_modules/.bin/claude"\n')
    realpathSyncMock.mockImplementation((p: string) => p)

    const { findClaudeExecutable } = await import('../../src/core/find-claude.js')
    expect(findClaudeExecutable()).toBe('/home/user/.claude/local/node_modules/.bin/claude')
  })

  it('falls back to ~/.claude/local/node_modules/.bin/claude', async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('which: command not found')
    })
    existsSyncMock.mockImplementation((path: string) => {
      return path.includes('node_modules/.bin/claude')
    })
    realpathSyncMock.mockImplementation((p: string) => p + '.js')

    const { findClaudeExecutable } = await import('../../src/core/find-claude.js')
    const result = findClaudeExecutable()
    expect(result).toContain('node_modules/.bin/claude')
  })

  it('throws CliError when nothing found', async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('which: command not found')
    })
    existsSyncMock.mockReturnValue(false)

    const { findClaudeExecutable } = await import('../../src/core/find-claude.js')
    expect(() => findClaudeExecutable()).toThrowError(/Claude CLI not found/)
  })
})
