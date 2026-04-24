export type InitFlowStep = 'keys' | 'target' | 'confirm' | 'done'
export type InitFlowTarget = 'preset'

export type InitFlowState = {
  step: InitFlowStep
  availableKeys: string[]
  selectedKeys: string[]
  target?: InitFlowTarget
}

export type InitFlowAction =
  | {
      type: 'select-keys'
      keys: string[]
    }
  | {
      type: 'select-target'
      target: InitFlowTarget
    }
  | {
      type: 'confirm'
    }

export function createInitFlowState(availableKeys: string[]): InitFlowState {
  return {
    step: 'keys',
    availableKeys,
    selectedKeys: [],
  }
}

export function advanceInitFlow(
  state: InitFlowState,
  action: InitFlowAction,
): InitFlowState {
  switch (state.step) {
    case 'keys':
      if (action.type !== 'select-keys') {
        return state
      }

      return {
        ...state,
        step: 'target',
        selectedKeys: action.keys,
      }

    case 'target':
      if (action.type !== 'select-target') {
        return state
      }

      return {
        ...state,
        step: 'confirm',
        target: action.target,
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
