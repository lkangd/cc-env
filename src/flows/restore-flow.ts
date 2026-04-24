export type RestoreRecord = {
  timestamp: string
  action: 'init' | 'restore'
  targetType: 'settings' | 'preset'
  targetName: string
  backup: Record<string, string>
}

export type RestoreFlowStep = 'record' | 'target' | 'confirm' | 'done'

export type RestoreFlowState = {
  step: RestoreFlowStep
  records: RestoreRecord[]
  selectedTimestamp?: string
  targetType?: 'settings' | 'preset'
  targetName?: string
}

export type RestoreFlowAction =
  | {
      type: 'select-record'
      timestamp: string
    }
  | {
      type: 'select-target'
      targetType: 'settings' | 'preset'
      targetName?: string
    }
  | {
      type: 'confirm'
    }

export function createRestoreFlowState(records: RestoreRecord[]): RestoreFlowState {
  return {
    step: 'record',
    records,
  }
}

export function advanceRestoreFlow(
  state: RestoreFlowState,
  action: RestoreFlowAction,
): RestoreFlowState {
  switch (state.step) {
    case 'record':
      if (action.type !== 'select-record') {
        return state
      }

      return {
        ...state,
        step: 'target',
        selectedTimestamp: action.timestamp,
      }

    case 'target':
      if (action.type !== 'select-target') {
        return state
      }

      return {
        ...state,
        step: 'confirm',
        targetType: action.targetType,
        targetName: action.targetName,
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
