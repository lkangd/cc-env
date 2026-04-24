export type PresetCreateSource = 'openai'
export type PresetCreateDestination = 'project' | 'preset'

export type PresetCreateStep = 'source' | 'keys' | 'confirm'

export type PresetCreateFlowState = {
  step: PresetCreateStep
  selectedSources: PresetCreateSource[]
  destination?: PresetCreateDestination
}

export type PresetCreateFlowAction =
  | {
      type: 'select-source'
      source: PresetCreateSource
    }
  | {
      type: 'select-destination'
      destination: PresetCreateDestination
    }

export function createPresetCreateFlowState(): PresetCreateFlowState {
  return {
    step: 'source',
    selectedSources: [],
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
      destination: state.destination,
    }
  }

  return {
    step: 'confirm',
    selectedSources: state.selectedSources,
    destination: action.destination,
  }
}
