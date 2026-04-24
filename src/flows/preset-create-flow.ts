export type PresetCreateSource = 'process' | 'settings' | 'project'
export type PresetCreateDestination = 'project' | 'preset'

export type PresetCreateStep = 'source' | 'keys' | 'destination' | 'confirm' | 'done'

export type PresetCreateFlowState = {
  step: PresetCreateStep
  selectedSources: PresetCreateSource[]
  selectedKeys: string[]
  destination?: PresetCreateDestination
}

export type PresetCreateFlowResult = Pick<
  PresetCreateFlowState,
  'selectedSources' | 'selectedKeys' | 'destination'
>

export type PresetCreateFlowAction =
  | {
      type: 'select-source'
      source: PresetCreateSource
    }
  | {
      type: 'select-keys'
      keys: string[]
    }
  | {
      type: 'select-destination'
      destination: PresetCreateDestination
    }
  | {
      type: 'confirm'
    }

export function createPresetCreateFlowState(): PresetCreateFlowState {
  return {
    step: 'source',
    selectedSources: [],
    selectedKeys: [],
  }
}

export function advancePresetCreateFlow(
  state: PresetCreateFlowState,
  action: PresetCreateFlowAction,
): PresetCreateFlowState {
  switch (state.step) {
    case 'source':
      if (action.type !== 'select-source') {
        return state
      }

      return {
        ...state,
        step: 'keys',
        selectedSources: [action.source],
      }

    case 'keys':
      if (action.type !== 'select-keys') {
        return state
      }

      return {
        ...state,
        step: 'destination',
        selectedKeys: action.keys,
      }

    case 'destination':
      if (action.type !== 'select-destination') {
        return state
      }

      return {
        ...state,
        step: 'confirm',
        destination: action.destination,
      }

    case 'confirm':
      if (action.type !== 'confirm') {
        return state
      }

      return {
        ...state,
        step: 'done',
      }

    case 'done':
      return state
  }
}
