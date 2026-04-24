import { describe, expect, it } from 'vitest'

import {
  advanceInitFlow,
  createInitFlowState,
} from '../../src/flows/init-flow.js'

describe('init flow', () => {
  it("starts on the keys step", () => {
    expect(createInitFlowState(['OPENAI_API_KEY', 'BASE_URL'])).toEqual({
      step: 'keys',
      availableKeys: ['OPENAI_API_KEY', 'BASE_URL'],
      selectedKeys: [],
    })
  })

  it('moves from keys to target when keys are selected', () => {
    const state = createInitFlowState(['OPENAI_API_KEY', 'BASE_URL'])

    expect(
      advanceInitFlow(state, {
        type: 'select-keys',
        keys: ['OPENAI_API_KEY'],
      }),
    ).toEqual({
      step: 'target',
      availableKeys: ['OPENAI_API_KEY', 'BASE_URL'],
      selectedKeys: ['OPENAI_API_KEY'],
    })
  })
})
