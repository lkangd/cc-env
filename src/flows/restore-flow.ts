export type RestoreRecord = {
  timestamp: string
  action: 'init' | 'restore'
  targetType: 'settings' | 'preset'
  targetName: string
  backup: Record<string, string>
}

export type RestoreFlowStep = 'record' | 'target' | 'confirm' | 'done'

type BaseRestoreFlowState = {
  records: RestoreRecord[]
  selectedTimestamp?: string
}

export type RestoreFlowState =
  | ({ step: 'record' } & BaseRestoreFlowState)
  | ({ step: 'target'; selectedTimestamp: string } & BaseRestoreFlowState)
  | ({ step: 'confirm'; selectedTimestamp: string } & BaseRestoreFlowState & (
      | {
          targetType: 'settings'
        }
      | {
          targetType: 'preset'
          targetName: string
        }
    ))
  | ({ step: 'done'; selectedTimestamp: string } & BaseRestoreFlowState & (
      | {
          targetType: 'settings'
        }
      | {
          targetType: 'preset'
          targetName: string
        }
    ))

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

      if (action.targetType === 'settings') {
        return {
          ...state,
          step: 'confirm',
          targetType: 'settings',
        }
      }

      const targetName = action.targetName as string

      return {
        ...state,
        step: 'confirm',
        targetType: 'preset',
        targetName,
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
