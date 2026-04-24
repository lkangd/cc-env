export type PresetCreateSource = 'process' | 'settings' | 'project'
export type PresetCreateDestination = 'project' | 'preset'

export type PresetCreateStep = 'source' | 'keys' | 'destination' | 'confirm' | 'done'

export type PresetCreateFlowState = {
  step: PresetCreateStep
  selectedSources: PresetCreateSource[]
  selectedKeys: string[]
  destination?: PresetCreateDestination
}

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
  if (action.type === 'select-source') {
    return {
      step: 'keys',
      selectedSources: [...state.selectedSources, action.source],
      selectedKeys: state.selectedKeys,
      destination: state.destination,
    }
  }

  if (action.type === 'select-keys') {
    return {
      step: 'destination',
      selectedSources: state.selectedSources,
      selectedKeys: action.keys,
      destination: state.destination,
    }
  }

  if (action.type === 'select-destination') {
    return {
      step: 'confirm',
      selectedSources: state.selectedSources,
      selectedKeys: state.selectedKeys,
      destination: action.destination,
    }
  }

  return {
    step: 'done',
    selectedSources: state.selectedSources,
    selectedKeys: state.selectedKeys,
    destination: state.destination,
  }
}
