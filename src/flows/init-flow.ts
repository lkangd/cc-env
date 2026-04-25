export type InitFlowStep = 'keys' | 'confirm' | 'done'

export type InitFlowState = {
  step: InitFlowStep
  availableKeys: string[]
  requiredKeys: string[]
  selectedKeys: string[]
}

export type InitFlowAction =
  | { type: 'toggle-key'; key: string }
  | { type: 'continue' }
  | { type: 'confirm' }

export function createInitFlowState(
  availableKeys: string[],
  requiredKeys: string[],
): InitFlowState {
  return {
    step: 'keys',
    availableKeys,
    requiredKeys,
    selectedKeys: requiredKeys,
  }
}

export function advanceInitFlow(
  state: InitFlowState,
  action: InitFlowAction,
): InitFlowState {
  if (state.step === 'keys' && action.type === 'toggle-key') {
    if (state.requiredKeys.includes(action.key)) {
      return state
    }

    const selectedKeys = state.selectedKeys.includes(action.key)
      ? state.selectedKeys.filter((key) => key !== action.key)
      : [...state.selectedKeys, action.key]

    return {
      ...state,
      selectedKeys,
    }
  }

  if (state.step === 'keys' && action.type === 'continue') {
    return {
      ...state,
      step: 'confirm',
    }
  }

  if (state.step === 'confirm' && action.type === 'confirm') {
    return {
      ...state,
      step: 'done',
    }
  }

  return state
}
