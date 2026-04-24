import { describe, expect, it } from 'vitest'

import {
  advanceRestoreFlow,
  createRestoreFlowState,
} from '../../src/flows/restore-flow.js'

describe('restore flow', () => {
  it('starts on the record step', () => {
    expect(
      createRestoreFlowState([
        {
          timestamp: '2026-04-24T00:00:00.000Z',
          action: 'init',
          targetType: 'preset',
          targetName: 'openai',
          backup: {
            OPENAI_API_KEY: 'sk-123',
          },
        },
      ]),
    ).toEqual({
      step: 'record',
      records: [
        {
          timestamp: '2026-04-24T00:00:00.000Z',
          action: 'init',
          targetType: 'preset',
          targetName: 'openai',
          backup: {
            OPENAI_API_KEY: 'sk-123',
          },
        },
      ],
    })
  })

  it('moves from record to target when a record is selected', () => {
    const state = createRestoreFlowState([
      {
        timestamp: '2026-04-24T00:00:00.000Z',
        action: 'init',
        targetType: 'preset',
        targetName: 'openai',
        backup: {
          OPENAI_API_KEY: 'sk-123',
        },
      },
    ])

    expect(
      advanceRestoreFlow(state, {
        type: 'select-record',
        timestamp: '2026-04-24T00:00:00.000Z',
      }),
    ).toEqual({
      step: 'target',
      records: [
        {
          timestamp: '2026-04-24T00:00:00.000Z',
          action: 'init',
          targetType: 'preset',
          targetName: 'openai',
          backup: {
            OPENAI_API_KEY: 'sk-123',
          },
        },
      ],
      selectedTimestamp: '2026-04-24T00:00:00.000Z',
    })
  })
})
