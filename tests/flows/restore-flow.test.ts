import { describe, expect, it } from 'vitest'

import {
  advanceRestoreFlow,
  createRestoreFlowState,
} from '../../src/flows/restore-flow.js'

const initRecord = {
  timestamp: '2026-04-24T00:00:00.000Z',
  action: 'init' as const,
  migratedKeys: ['ANTHROPIC_AUTH_TOKEN'],
  sources: [
    {
      file: '/Users/test/.claude/settings.json',
      backup: {},
    },
    {
      file: '/Users/test/.claude/settings.local.json',
      backup: {
        ANTHROPIC_AUTH_TOKEN: 'local-token',
      },
    },
  ],
  shellWrites: [
    {
      shell: 'zsh' as const,
      filePath: '/Users/test/.zshrc',
      env: {
        ANTHROPIC_AUTH_TOKEN: 'local-token',
      },
    },
  ],
}

const restoreRecord = {
  timestamp: '2026-04-25T00:00:00.000Z',
  action: 'restore' as const,
  targetType: 'preset' as const,
  targetName: 'openai',
  backup: {
    OPENAI_API_KEY: 'sk-123',
  },
}

function createConfirmState() {
  const recordState = createRestoreFlowState([restoreRecord])
  const targetState = advanceRestoreFlow(recordState, {
    type: 'select-record',
    timestamp: restoreRecord.timestamp,
  })

  return advanceRestoreFlow(targetState, {
    type: 'select-target',
    targetType: 'preset',
    targetName: restoreRecord.targetName,
  })
}

describe('restore flow', () => {
  it('starts on the record step', () => {
    expect(createRestoreFlowState([restoreRecord])).toEqual({
      step: 'record',
      records: [restoreRecord],
    })
  })

  it('skips target selection for init history entries', () => {
    const state = createRestoreFlowState([initRecord])

    expect(
      advanceRestoreFlow(state, {
        type: 'select-record',
        timestamp: initRecord.timestamp,
      }),
    ).toEqual({
      step: 'confirm',
      records: [initRecord],
      selectedTimestamp: initRecord.timestamp,
    })
  })

  it('moves from record to target for restore history entries', () => {
    const state = createRestoreFlowState([restoreRecord])

    expect(
      advanceRestoreFlow(state, {
        type: 'select-record',
        timestamp: restoreRecord.timestamp,
      }),
    ).toEqual({
      step: 'target',
      records: [restoreRecord],
      selectedTimestamp: restoreRecord.timestamp,
    })
  })

  it('keeps the record step unchanged when selecting an unknown timestamp', () => {
    const state = createRestoreFlowState([restoreRecord])

    expect(
      advanceRestoreFlow(state, {
        type: 'select-record',
        timestamp: '2026-04-26T00:00:00.000Z',
      }),
    ).toEqual(state)
  })

  it('moves through target, confirm, and done after selecting a restore record', () => {
    const confirmState = createConfirmState()

    expect(confirmState).toEqual({
      step: 'confirm',
      records: [restoreRecord],
      selectedTimestamp: restoreRecord.timestamp,
      targetType: 'preset',
      targetName: restoreRecord.targetName,
    })
    expect(advanceRestoreFlow(confirmState, { type: 'confirm' })).toEqual({
      step: 'done',
      records: [restoreRecord],
      selectedTimestamp: restoreRecord.timestamp,
      targetType: 'preset',
      targetName: restoreRecord.targetName,
    })
  })

  it('finishes an init restore after confirm', () => {
    const confirmState = advanceRestoreFlow(createRestoreFlowState([initRecord]), {
      type: 'select-record',
      timestamp: initRecord.timestamp,
    })

    expect(advanceRestoreFlow(confirmState, { type: 'confirm' })).toEqual({
      step: 'done',
      records: [initRecord],
      selectedTimestamp: initRecord.timestamp,
    })
  })

  it('keeps state unchanged for invalid transitions and missing target name', () => {
    const recordState = createRestoreFlowState([restoreRecord])

    expect(advanceRestoreFlow(recordState, { type: 'confirm' })).toEqual(recordState)

    const targetState = advanceRestoreFlow(recordState, {
      type: 'select-record',
      timestamp: restoreRecord.timestamp,
    })

    expect(advanceRestoreFlow(targetState, { type: 'confirm' })).toEqual(targetState)
    expect(
      advanceRestoreFlow(targetState, {
        type: 'select-target',
        targetType: 'preset',
      }),
    ).toEqual(targetState)

    const brokenConfirmState = {
      ...targetState,
      step: 'confirm' as const,
      targetType: 'preset' as const,
    }
    expect(advanceRestoreFlow(brokenConfirmState, { type: 'confirm' })).toEqual(brokenConfirmState)
  })

})
