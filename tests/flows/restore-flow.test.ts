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

  it('ignores later-step actions while still on the record step', () => {
    const state = createRestoreFlowState([restoreRecord])

    expect(
      advanceRestoreFlow(state, {
        type: 'select-target',
        targetType: 'settings',
      }),
    ).toEqual(state)
    expect(advanceRestoreFlow(state, { type: 'confirm' })).toEqual(state)
  })

  it('ignores record and confirm actions while on the target step', () => {
    const targetState = advanceRestoreFlow(createRestoreFlowState([restoreRecord]), {
      type: 'select-record',
      timestamp: restoreRecord.timestamp,
    })

    expect(
      advanceRestoreFlow(targetState, {
        type: 'select-record',
        timestamp: restoreRecord.timestamp,
      }),
    ).toEqual(targetState)
    expect(advanceRestoreFlow(targetState, { type: 'confirm' })).toEqual(targetState)
  })

  it('requires a preset target name before moving to confirm', () => {
    const targetState = advanceRestoreFlow(createRestoreFlowState([restoreRecord]), {
      type: 'select-record',
      timestamp: restoreRecord.timestamp,
    })

    expect(
      advanceRestoreFlow(targetState, {
        type: 'select-target',
        targetType: 'preset',
      }),
    ).toEqual(targetState)
  })

  it('clears stale targetName when selecting settings', () => {
    const targetState = advanceRestoreFlow(createRestoreFlowState([restoreRecord]), {
      type: 'select-record',
      timestamp: restoreRecord.timestamp,
    })

    expect(
      advanceRestoreFlow(targetState, {
        type: 'select-target',
        targetType: 'settings',
        targetName: restoreRecord.targetName,
      }),
    ).toEqual({
      step: 'confirm',
      records: [restoreRecord],
      selectedTimestamp: restoreRecord.timestamp,
      targetType: 'settings',
    })
  })

  it('ignores non-confirm actions while on the confirm step', () => {
    const confirmState = createConfirmState()

    expect(
      advanceRestoreFlow(confirmState, {
        type: 'select-record',
        timestamp: restoreRecord.timestamp,
      }),
    ).toEqual(confirmState)
    expect(
      advanceRestoreFlow(confirmState, {
        type: 'select-target',
        targetType: 'settings',
      }),
    ).toEqual(confirmState)
  })

  it('does not finish with a structurally invalid confirm state', () => {
    const invalidConfirmState = {
      step: 'confirm' as const,
      records: [restoreRecord],
      selectedTimestamp: restoreRecord.timestamp,
    }

    expect(
      advanceRestoreFlow(
        invalidConfirmState as unknown as Parameters<typeof advanceRestoreFlow>[0],
        { type: 'confirm' },
      ),
    ).toEqual(invalidConfirmState)
  })

  it('does not finish preset confirmation without a preset name', () => {
    const invalidConfirmState = {
      step: 'confirm' as const,
      records: [restoreRecord],
      selectedTimestamp: restoreRecord.timestamp,
      targetType: 'preset' as const,
    }

    expect(
      advanceRestoreFlow(
        invalidConfirmState as unknown as Parameters<typeof advanceRestoreFlow>[0],
        { type: 'confirm' },
      ),
    ).toEqual(invalidConfirmState)
  })

  it('keeps the done step unchanged for any later action', () => {
    const doneState = advanceRestoreFlow(createConfirmState(), { type: 'confirm' })

    expect(
      advanceRestoreFlow(doneState, {
        type: 'select-record',
        timestamp: restoreRecord.timestamp,
      }),
    ).toEqual(doneState)
    expect(
      advanceRestoreFlow(doneState, {
        type: 'select-target',
        targetType: 'settings',
      }),
    ).toEqual(doneState)
    expect(advanceRestoreFlow(doneState, { type: 'confirm' })).toEqual(doneState)
  })
})
