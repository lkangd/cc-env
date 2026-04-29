import { describe, expect, it } from 'vitest'

import { createRestoreFlowState } from '../../src/flows/restore-flow.js'
import { getRestorePreviewSections } from '../../src/ink/restore-app.js'

describe('RestoreApp helpers', () => {
  it('returns file-level preview sections for detected restore records', () => {
    const state = createRestoreFlowState(
      [
        {
          timestamp: 't1',
          action: 'preset-create',
          projectPath: '/repo',
          presetName: 'claude-prod',
          destination: 'global',
          migratedKeys: ['A'],
          sources: [
            { file: '/repo/.claude/settings.json', backup: { A: '1' } },
            { file: '/repo/.claude/settings.local.json', backup: { B: '2' } },
          ],
        },
      ],
      '/repo',
    )

    expect(state.groups).toEqual([
      { title: 'Current project', start: 0, end: 1 },
    ])

    expect(getRestorePreviewSections(state.records[0])).toEqual([
      {
        file: '/repo/.claude/settings.json',
        entries: [['A', '1']],
      },
      {
        file: '/repo/.claude/settings.local.json',
        entries: [['B', '2']],
      },
    ])
  })
})
