import { describe, expect, it } from 'vitest'

import {
  advancePresetCreateFlow,
  createPresetCreateFlowState,
} from '../../src/flows/preset-create-flow.js'

describe('preset create flow', () => {
  it("createPresetCreateFlowState() starts at step 'source'", () => {
    expect(createPresetCreateFlowState()).toEqual({
      step: 'source',
      selectedSources: [],
    })
  })

  it('selecting source moves to keys and records selectedSources', () => {
    const state = createPresetCreateFlowState()

    expect(
      advancePresetCreateFlow(state, {
        type: 'select-source',
        source: 'openai',
      }),
    ).toEqual({
      step: 'keys',
      selectedSources: ['openai'],
    })
  })

  it('selecting destination records destination and moves to confirm', () => {
    const sourceState = advancePresetCreateFlow(createPresetCreateFlowState(), {
      type: 'select-source',
      source: 'openai',
    })

    expect(
      advancePresetCreateFlow(sourceState, {
        type: 'select-destination',
        destination: 'project',
      }),
    ).toEqual({
      step: 'confirm',
      selectedSources: ['openai'],
      destination: 'project',
    })
  })
})
