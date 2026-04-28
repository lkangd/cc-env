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

  it('toggles optional keys on and off and handles confirm transition', () => {
    const base = createInitFlowState(['ANTHROPIC_AUTH_TOKEN', 'EXTRA_KEY'], ['ANTHROPIC_AUTH_TOKEN'])

    const toggledOn = advanceInitFlow(base, { type: 'toggle-key', key: 'EXTRA_KEY' })
    expect(toggledOn.selectedKeys).toEqual(['ANTHROPIC_AUTH_TOKEN', 'EXTRA_KEY'])

    const toggledOff = advanceInitFlow(toggledOn, { type: 'toggle-key', key: 'EXTRA_KEY' })
    expect(toggledOff.selectedKeys).toEqual(['ANTHROPIC_AUTH_TOKEN'])

    const confirmState = advanceInitFlow(base, { type: 'continue' })
    expect(advanceInitFlow(confirmState, { type: 'continue' })).toEqual(confirmState)
    expect(advanceInitFlow(confirmState, { type: 'confirm' })).toEqual({
      ...confirmState,
      step: 'done',
    })
  })

})
