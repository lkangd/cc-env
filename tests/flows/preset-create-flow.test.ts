import { describe, expect, it } from 'vitest'

import {
  advancePresetCreateFlow,
  createPresetCreateFlowState,
  type PresetCreateFlowState,
} from '../../src/flows/preset-create-flow.js'

describe('preset create flow', () => {
  function createCompleteFlowState(): PresetCreateFlowState {
    return advancePresetCreateFlow(
      advancePresetCreateFlow(
        advancePresetCreateFlow(createPresetCreateFlowState(), {
          type: 'select-source',
          source: 'process',
        }),
        {
          type: 'select-keys',
          keys: ['ANTHROPIC_BASE_URL'],
        },
      ),
      {
        type: 'select-destination',
        destination: 'preset',
      },
    )
  }

  it("createPresetCreateFlowState() starts at step 'source'", () => {
    expect(createPresetCreateFlowState()).toEqual({
      step: 'source',
      selectedSources: [],
      selectedKeys: [],
    })
  })

  it('moves from source to keys and records selectedSources', () => {
    const state = createPresetCreateFlowState()

    expect(
      advancePresetCreateFlow(state, {
        type: 'select-source',
        source: 'process',
      }),
    ).toEqual({
      step: 'keys',
      selectedSources: ['process'],
      selectedKeys: [],
    })
  })

  it('moves from keys to destination and records selectedKeys', () => {
    const sourceState = advancePresetCreateFlow(createPresetCreateFlowState(), {
      type: 'select-source',
      source: 'process',
    })

    expect(
      advancePresetCreateFlow(sourceState, {
        type: 'select-keys',
        keys: ['ANTHROPIC_BASE_URL'],
      }),
    ).toEqual({
      step: 'destination',
      selectedSources: ['process'],
      selectedKeys: ['ANTHROPIC_BASE_URL'],
    })
  })

  it('moves from destination to confirm and records destination', () => {
    const keysState = advancePresetCreateFlow(
      advancePresetCreateFlow(createPresetCreateFlowState(), {
        type: 'select-source',
        source: 'process',
      }),
      {
        type: 'select-keys',
        keys: ['ANTHROPIC_BASE_URL'],
      },
    )

    expect(
      advancePresetCreateFlow(keysState, {
        type: 'select-destination',
        destination: 'project',
      }),
    ).toEqual({
      step: 'confirm',
      selectedSources: ['process'],
      selectedKeys: ['ANTHROPIC_BASE_URL'],
      destination: 'project',
    })
  })

  it('moves from confirm to done on confirm', () => {
    const confirmState = createCompleteFlowState()

    expect(
      advancePresetCreateFlow(confirmState, {
        type: 'confirm',
      }),
    ).toEqual({
      step: 'done',
      selectedSources: ['process'],
      selectedKeys: ['ANTHROPIC_BASE_URL'],
      destination: 'preset',
    })
  })

  it('ignores invalid transitions without mutating state', () => {
    const state = createPresetCreateFlowState()

    expect(
      advancePresetCreateFlow(state, {
        type: 'select-keys',
        keys: ['ANTHROPIC_BASE_URL'],
      }),
    ).toEqual(state)

    expect(
      advancePresetCreateFlow(state, {
        type: 'select-destination',
        destination: 'project',
      }),
    ).toEqual(state)

    expect(
      advancePresetCreateFlow(state, {
        type: 'confirm',
      }),
    ).toEqual(state)
  })

  it('ignores select-source after leaving the source step', () => {
    const keysState = advancePresetCreateFlow(createPresetCreateFlowState(), {
      type: 'select-source',
      source: 'process',
    })

    expect(
      advancePresetCreateFlow(keysState, {
        type: 'select-source',
        source: 'process',
      }),
    ).toEqual(keysState)
  })

  it('ignores changes after the flow is done', () => {
    const doneState = advancePresetCreateFlow(createCompleteFlowState(), {
      type: 'confirm',
    })

    expect(
      advancePresetCreateFlow(doneState, {
        type: 'select-source',
        source: 'settings',
      }),
    ).toEqual(doneState)
  })
})
