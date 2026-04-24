import { describe, expect, it } from 'vitest'

import {
  advanceRestoreFlow,
  createRestoreFlowState,
} from '../../src/flows/restore-flow.js'

const restoreRecord = {
  timestamp: '2026-04-24T00:00:00.000Z',
  action: 'init' as const,
  targetType: 'preset' as const,
  targetName: 'openai',
  backup: {
    OPENAI_API_KEY: 'sk-123',
  },
}

describe('restore flow', () => {
  it('starts on the record step', () => {
    expect(createRestoreFlowState([restoreRecord])).toEqual({
      step: 'record',
      records: [restoreRecord],
    })
  })

  it('moves from record to target when a record is selected', () => {
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
        timestamp: '2026-04-25T00:00:00.000Z',
      }),
    ).toEqual(state)
  })

  it('moves through target, confirm, and done after selecting a record', () => {
    const recordState = createRestoreFlowState([restoreRecord])
    const targetState = advanceRestoreFlow(recordState, {
      type: 'select-record',
      timestamp: restoreRecord.timestamp,
    })
    const confirmState = advanceRestoreFlow(targetState, {
      type: 'select-target',
      targetType: 'preset',
      targetName: restoreRecord.targetName,
    })

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
})
