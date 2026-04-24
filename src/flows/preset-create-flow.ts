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
  if (state.step === 'source' && action.type === 'select-source') {
    if (state.selectedSources[0] === action.source) {
      return state
    }

    return {
      step: 'keys',
      selectedSources: [action.source],
      selectedKeys: state.selectedKeys,
      destination: state.destination,
    }
  }

  if (state.step === 'keys' && action.type === 'select-keys') {
    return {
      step: 'destination',
      selectedSources: state.selectedSources,
      selectedKeys: action.keys,
      destination: state.destination,
    }
  }

  if (state.step === 'destination' && action.type === 'select-destination') {
    return {
      step: 'confirm',
      selectedSources: state.selectedSources,
      selectedKeys: state.selectedKeys,
      destination: action.destination,
    }
  }

  if (state.step === 'confirm' && action.type === 'confirm') {
    return {
      step: 'done',
      selectedSources: state.selectedSources,
      selectedKeys: state.selectedKeys,
      destination: state.destination,
    }
  }

  return state
}
