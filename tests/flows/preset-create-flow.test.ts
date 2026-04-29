import { describe, expect, it } from 'vitest'

import {
  advancePresetCreateFlow,
  createPresetCreateFlowState,
  type PresetCreateFlowState,
} from '../../src/flows/preset-create-flow.js'

describe('preset create flow', () => {
  it('starts at detectedPrompt when detected env exists', () => {
    const state = createPresetCreateFlowState({
      detectedEnv: {
        ANTHROPIC_AUTH_TOKEN: 'token',
        ANTHROPIC_BASE_URL: 'https://api.example.com',
        OPENAI_API_KEY: 'sk-openai',
      },
      requiredKeys: ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'],
    })

    expect(state.step).toBe('detectedPrompt')
    expect(state.selectedKeys).toEqual(['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'])
    expect(state.requiredKeys).toEqual(['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'])
  })

  it('choosing detected prompt yes advances to detected key selection', () => {
    const state = createPresetCreateFlowState({
      detectedEnv: {
        ANTHROPIC_AUTH_TOKEN: 'token',
        OPENAI_API_KEY: 'sk-openai',
      },
      requiredKeys: ['ANTHROPIC_AUTH_TOKEN'],
    })

    const next = advancePresetCreateFlow(state, { type: 'accept-detected-prompt' })

    expect(next.step).toBe('detected')
    expect(next.selectedKeys).toEqual(['ANTHROPIC_AUTH_TOKEN'])
  })

  it('choosing detected prompt no returns to source selection', () => {
    const state = createPresetCreateFlowState({
      detectedEnv: {
        ANTHROPIC_AUTH_TOKEN: 'token',
        OPENAI_API_KEY: 'sk-openai',
      },
      requiredKeys: ['ANTHROPIC_AUTH_TOKEN'],
    })

    const next = advancePresetCreateFlow(state, { type: 'reject-detected-prompt' })

    expect(next.step).toBe('source')
    expect(next.source).toBeUndefined()
  })

  it('does not deselect a required detected key', () => {
    const state = createPresetCreateFlowState({
      detectedEnv: {
        ANTHROPIC_AUTH_TOKEN: 'token',
        OPENAI_API_KEY: 'sk-openai',
      },
      requiredKeys: ['ANTHROPIC_AUTH_TOKEN'],
    })

    const next = advancePresetCreateFlow(state, {
      type: 'toggle-detected-key',
      key: 'ANTHROPIC_AUTH_TOKEN',
    })

    expect(next.selectedKeys).toEqual(['ANTHROPIC_AUTH_TOKEN'])
  })

  it('toggles an optional detected key and confirms into name step', () => {
    const state = createPresetCreateFlowState({
      detectedEnv: {
        ANTHROPIC_AUTH_TOKEN: 'token',
        OPENAI_API_KEY: 'sk-openai',
      },
      requiredKeys: ['ANTHROPIC_AUTH_TOKEN'],
    })

    const prompted = advancePresetCreateFlow(state, { type: 'accept-detected-prompt' })
    const toggled = advancePresetCreateFlow(prompted, {
      type: 'toggle-detected-key',
      key: 'OPENAI_API_KEY',
    })
    const confirmed = advancePresetCreateFlow(toggled, { type: 'confirm-detected-keys' })

    expect(prompted.step).toBe('detected')
    expect(toggled.selectedKeys).toEqual(['ANTHROPIC_AUTH_TOKEN', 'OPENAI_API_KEY'])
    expect(confirmed.step).toBe('name')
    expect(confirmed.source).toBe('detected')
  })

  it('prompt acceptance preserves later detected key selection behavior', () => {
    const state = createPresetCreateFlowState({
      detectedEnv: {
        ANTHROPIC_AUTH_TOKEN: 'token',
        OPENAI_API_KEY: 'sk-openai',
      },
      requiredKeys: ['ANTHROPIC_AUTH_TOKEN'],
    })

    const prompted = advancePresetCreateFlow(state, { type: 'accept-detected-prompt' })
    const toggled = advancePresetCreateFlow(prompted, {
      type: 'toggle-detected-key',
      key: 'OPENAI_API_KEY',
    })
    const confirmed = advancePresetCreateFlow(toggled, { type: 'confirm-detected-keys' })

    expect(prompted.step).toBe('detected')
    expect(toggled.selectedKeys).toEqual(['ANTHROPIC_AUTH_TOKEN', 'OPENAI_API_KEY'])
    expect(confirmed.step).toBe('name')
  })

  it("starts at step 'source' with empty defaults", () => {
    expect(createPresetCreateFlowState()).toEqual({
      step: 'source',
      env: {},
      allKeys: [],
      selectedKeys: [],
      requiredKeys: [],
      presetName: '',
    })
  })

  describe('file path', () => {
    function goToFilePath(): PresetCreateFlowState {
      return advancePresetCreateFlow(createPresetCreateFlowState(), {
        type: 'select-source',
        source: 'file',
      })
    }

    it('source=file advances to filePath', () => {
      expect(goToFilePath().step).toBe('filePath')
    })

    it('set-file-path advances to keys', () => {
      const state = advancePresetCreateFlow(goToFilePath(), {
        type: 'set-file-path',
        filePath: '/path/to/env.json',
      })
      expect(state.step).toBe('keys')
      expect(state.filePath).toBe('/path/to/env.json')
    })

    it('set-error stays on filePath with error message', () => {
      const state = advancePresetCreateFlow(goToFilePath(), {
        type: 'set-error',
        error: 'File not found',
      })
      expect(state.step).toBe('filePath')
      expect(state.error).toBe('File not found')
    })
  })

  describe('manual input path', () => {
    function goToManualInput(): PresetCreateFlowState {
      return advancePresetCreateFlow(createPresetCreateFlowState(), {
        type: 'select-source',
        source: 'manual',
      })
    }

    it('source=manual advances to manualInput', () => {
      expect(goToManualInput().step).toBe('manualInput')
    })

    it('add-manual-pair accumulates pairs', () => {
      const state = advancePresetCreateFlow(goToManualInput(), {
        type: 'add-manual-pair',
        key: 'FOO',
        value: 'bar',
      })
      expect(state.env).toEqual({ FOO: 'bar' })
      expect(state.selectedKeys).toEqual(['FOO'])
      expect(state.step).toBe('manualInput')
    })

    it('add-manual-pair overwrites existing key', () => {
      const first = advancePresetCreateFlow(goToManualInput(), {
        type: 'add-manual-pair',
        key: 'FOO',
        value: 'bar',
      })
      const second = advancePresetCreateFlow(first, {
        type: 'add-manual-pair',
        key: 'FOO',
        value: 'updated',
      })
      expect(second.env.FOO).toBe('updated')
      expect(second.selectedKeys).toEqual(['FOO'])
    })

    it('set-error on manualInput sets error', () => {
      const state = advancePresetCreateFlow(goToManualInput(), {
        type: 'set-error',
        error: 'Invalid format',
      })
      expect(state.error).toBe('Invalid format')
    })

    it('finish-manual-input advances to name', () => {
      const state = advancePresetCreateFlow(goToManualInput(), {
        type: 'finish-manual-input',
      })
      expect(state.step).toBe('name')
    })
  })

  describe('shared path after source input', () => {
    function goToNameViaFile(): PresetCreateFlowState {
      const filePath = advancePresetCreateFlow(createPresetCreateFlowState(), {
        type: 'select-source',
        source: 'file',
      })
      const keys = advancePresetCreateFlow(filePath, {
        type: 'set-file-path',
        filePath: '/env.json',
      })
      return advancePresetCreateFlow(keys, {
        type: 'select-keys',
        keys: ['API_KEY'],
        env: { API_KEY: 'secret' },
      })
    }

    function goToNameViaManual(): PresetCreateFlowState {
      const manual = advancePresetCreateFlow(createPresetCreateFlowState(), {
        type: 'select-source',
        source: 'manual',
      })
      return advancePresetCreateFlow(manual, {
        type: 'finish-manual-input',
      })
    }

    it('set-name advances to destination', () => {
      const state = advancePresetCreateFlow(goToNameViaFile(), {
        type: 'set-name',
        name: 'my-preset',
      })
      expect(state.step).toBe('destination')
      expect(state.presetName).toBe('my-preset')
    })

    it('select-destination advances to confirm', () => {
      const name = advancePresetCreateFlow(goToNameViaFile(), {
        type: 'set-name',
        name: 'my-preset',
      })
      const dest = advancePresetCreateFlow(name, {
        type: 'select-destination',
        destination: 'global',
      })
      expect(dest.step).toBe('confirm')
      expect(dest.destination).toBe('global')
    })

    it('confirm advances to done', () => {
      const name = advancePresetCreateFlow(goToNameViaFile(), {
        type: 'set-name',
        name: 'my-preset',
      })
      const dest = advancePresetCreateFlow(name, {
        type: 'select-destination',
        destination: 'project',
      })
      const done = advancePresetCreateFlow(dest, { type: 'confirm' })
      expect(done.step).toBe('done')
    })

    it('manual path reaches done through name→destination→confirm', () => {
      const name = advancePresetCreateFlow(goToNameViaManual(), {
        type: 'set-name',
        name: 'manual-preset',
      })
      const dest = advancePresetCreateFlow(name, {
        type: 'select-destination',
        destination: 'global',
      })
      const done = advancePresetCreateFlow(dest, { type: 'confirm' })
      expect(done.step).toBe('done')
      expect(done.presetName).toBe('manual-preset')
    })
  })

  it('ignores invalid transitions without mutating state', () => {
    const state = createPresetCreateFlowState()

    expect(
      advancePresetCreateFlow(state, {
        type: 'select-keys',
        keys: ['FOO'],
        env: { FOO: 'bar' },
      }),
    ).toEqual(state)

    expect(
      advancePresetCreateFlow(state, {
        type: 'confirm',
      }),
    ).toEqual(state)
  })

  it('ignores changes after the flow is done', () => {
    const source = advancePresetCreateFlow(createPresetCreateFlowState(), {
      type: 'select-source',
      source: 'manual',
    })
    const name = advancePresetCreateFlow(source, {
      type: 'finish-manual-input',
    })
    const dest = advancePresetCreateFlow(name, {
      type: 'set-name',
      name: 'test',
    })
    const confirm = advancePresetCreateFlow(dest, {
      type: 'select-destination',
      destination: 'global',
    })
    const done = advancePresetCreateFlow(confirm, { type: 'confirm' })

    expect(
      advancePresetCreateFlow(done, {
        type: 'select-source',
        source: 'file',
      }),
    ).toEqual(done)
  })
})
