import { describe, expect, it } from 'vitest'

import {
  advanceInitFlow,
  createInitFlowState,
} from '../../src/flows/init-flow.js'

describe('init flow', () => {
  it('preselects required keys and does not let them be toggled off', () => {
    const state = createInitFlowState(
      ['ANTHROPIC_AUTH_TOKEN', 'EXTRA_KEY'],
      ['ANTHROPIC_AUTH_TOKEN'],
    )

    expect(state).toEqual({
      step: 'keys',
      availableKeys: ['ANTHROPIC_AUTH_TOKEN', 'EXTRA_KEY'],
      requiredKeys: ['ANTHROPIC_AUTH_TOKEN'],
      selectedKeys: ['ANTHROPIC_AUTH_TOKEN'],
    })

    expect(
      advanceInitFlow(state, {
        type: 'toggle-key',
        key: 'ANTHROPIC_AUTH_TOKEN',
      }).selectedKeys,
    ).toEqual(['ANTHROPIC_AUTH_TOKEN'])
  })

  it('moves directly from key selection to confirm', () => {
    const state = createInitFlowState(['ANTHROPIC_AUTH_TOKEN'], ['ANTHROPIC_AUTH_TOKEN'])

    expect(advanceInitFlow(state, { type: 'continue' })).toEqual({
      step: 'confirm',
      availableKeys: ['ANTHROPIC_AUTH_TOKEN'],
      requiredKeys: ['ANTHROPIC_AUTH_TOKEN'],
      selectedKeys: ['ANTHROPIC_AUTH_TOKEN'],
    })
  })
})
