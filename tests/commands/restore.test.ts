import { describe, expect, it, vi } from 'vitest'

import { createRestoreCommand } from '../../src/commands/restore.js'
import { CliError } from '../../src/core/errors.js'

function createMocks() {
  return {
    historyService: { list: vi.fn() },
    claudeSettingsEnvService: { read: vi.fn(), write: vi.fn() },
    shellEnvService: { removeKeys: vi.fn() },
    settingsEnvService: { read: vi.fn(), write: vi.fn() },
    presetService: { read: vi.fn(), write: vi.fn() },
    renderFlow: vi.fn(),
    renderEnvSummary: vi.fn().mockResolvedValue(undefined),
  }
}

describe('createRestoreCommand', () => {
  it('includes preset-create history records in restore choices', async () => {
    const m = createMocks()
    m.historyService.list.mockResolvedValue([
      {
        timestamp: 't1',
        action: 'preset-create',
        projectPath: '/repo',
        presetName: 'claude-prod',
        destination: 'global',
        migratedKeys: ['A'],
        sources: [{ file: '/repo/.claude/settings.json', backup: { A: '1' } }],
      },
      { timestamp: 't2', action: 'restore', targetType: 'settings', targetName: 'settings', backup: { B: '2' } },
    ])
    m.renderFlow.mockResolvedValue({ confirmed: false })

    const restore = createRestoreCommand(m as any)
    await restore({ yes: false })

    expect(m.renderFlow).toHaveBeenCalledWith({
      records: [
        {
          timestamp: 't1',
          action: 'preset-create',
          projectPath: '/repo',
          presetName: 'claude-prod',
          destination: 'global',
          migratedKeys: ['A'],
          sources: [{ file: '/repo/.claude/settings.json', backup: { A: '1' } }],
        },
        { timestamp: 't2', action: 'restore', targetType: 'settings', targetName: 'settings', backup: { B: '2' } },
      ],
      yes: false,
    })
  })

  it('throws when selected record is missing', async () => {
    const m = createMocks()
    m.historyService.list.mockResolvedValue([{ timestamp: 't1', action: 'restore', targetType: 'preset', targetName: 'a', backup: {} }])
    m.renderFlow.mockResolvedValue({ confirmed: true, timestamp: 'missing', targetType: 'preset', targetName: 'a' })

    const restore = createRestoreCommand(m as any)
    await expect(restore({ yes: true })).rejects.toEqual(new CliError('Restore record not found'))
  })

  it('restores detected preset history directly to its source files', async () => {
    const m = createMocks()
    m.historyService.list.mockResolvedValue([
      {
        timestamp: 't1',
        action: 'preset-create',
        projectPath: '/repo',
        presetName: 'claude-prod',
        destination: 'global',
        migratedKeys: ['ANTHROPIC_AUTH_TOKEN'],
        sources: [
          { file: '/home/.claude/settings.json', backup: {} },
          { file: '/repo/.claude/settings.local.json', backup: { ANTHROPIC_AUTH_TOKEN: 'token' } },
        ],
      },
    ])
    m.renderFlow.mockResolvedValue({ confirmed: true, timestamp: 't1' })
    m.claudeSettingsEnvService.read.mockResolvedValue([
      { path: '/home/.claude/settings.json', exists: true, env: {} },
      { path: '/repo/.claude/settings.local.json', exists: true, env: {} },
    ])

    const restore = createRestoreCommand(m as any)
    await restore({ yes: true })

    expect(m.claudeSettingsEnvService.write).toHaveBeenCalledWith([
      { path: '/home/.claude/settings.json', env: {} },
      { path: '/repo/.claude/settings.local.json', env: { ANTHROPIC_AUTH_TOKEN: 'token' } },
    ])
    expect(m.settingsEnvService.write).not.toHaveBeenCalled()
    expect(m.presetService.write).not.toHaveBeenCalled()
  })

  it('restores to settings when targetType is settings', async () => {
    const m = createMocks()
    m.historyService.list.mockResolvedValue([{ timestamp: 't1', action: 'restore', targetType: 'settings', backup: { A: '1' } }])
    m.renderFlow.mockResolvedValue({ confirmed: true, timestamp: 't1', targetType: 'settings' })
    m.settingsEnvService.read.mockResolvedValue({ B: '2' })

    const restore = createRestoreCommand(m as any)
    await restore({ yes: true })

    expect(m.settingsEnvService.write).toHaveBeenCalledWith({ B: '2', A: '1' })
    expect(m.renderEnvSummary).toHaveBeenCalledWith(expect.objectContaining({ title: 'Restored to settings' }))
  })

  it('restores to preset using fallback record targetName', async () => {
    const m = createMocks()
    m.historyService.list.mockResolvedValue([{ timestamp: 't1', action: 'restore', targetType: 'preset', targetName: 'openai', backup: { A: '1' } }])
    m.renderFlow.mockResolvedValue({ confirmed: true, timestamp: 't1', targetType: 'preset' })
    m.presetService.read.mockResolvedValue({ name: 'openai', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', env: { B: '2' } })

    const restore = createRestoreCommand(m as any)
    await restore({ yes: true })

    expect(m.presetService.read).toHaveBeenCalledWith('openai')
    expect(m.presetService.write).toHaveBeenCalledWith(expect.objectContaining({ env: { B: '2', A: '1' } }))
  })

  it('returns silently when flow is not confirmed', async () => {
    const m = createMocks()
    m.historyService.list.mockResolvedValue([])
    m.renderFlow.mockResolvedValue({ confirmed: false })

    const restore = createRestoreCommand(m as any)
    await restore({ yes: true })

    expect(m.settingsEnvService.write).not.toHaveBeenCalled()
    expect(m.presetService.write).not.toHaveBeenCalled()
  })
})
