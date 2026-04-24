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

      const selectedRecord = state.records.find(
        (record) => record.timestamp === action.timestamp,
      )

      if (!selectedRecord) {
        return state
      }

      return {
        ...state,
        step: 'target',
        selectedTimestamp: action.timestamp,
      }

    case 'target':
      if (action.type !== 'select-target' || !state.selectedTimestamp) {
        return state
      }

      if (action.targetType === 'preset' && !action.targetName) {
        return state
      }

      return {
        ...state,
        step: 'confirm',
        targetType: action.targetType,
        targetName: action.targetType === 'preset' ? action.targetName : undefined,
      }

    case 'confirm':
      if (action.type !== 'confirm' || !state.selectedTimestamp || !state.targetType) {
        return state
      }

      if (state.targetType === 'preset' && !state.targetName) {
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
