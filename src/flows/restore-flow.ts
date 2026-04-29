import type { HistoryRecord } from '../core/schema.js'

export type RestoreFlowStep = 'record' | 'target' | 'confirm' | 'done'

export type RestoreFlowGroup = {
  title: 'Current project' | 'Other history'
  start: number
  end: number
}

type BaseRestoreFlowState = {
  records: HistoryRecord[]
  groups: RestoreFlowGroup[]
  selectedTimestamp?: string
}

export type RestoreFlowState =
  | ({ step: 'record' } & BaseRestoreFlowState)
  | ({ step: 'target'; selectedTimestamp: string } & BaseRestoreFlowState)
  | ({ step: 'confirm'; selectedTimestamp: string } & BaseRestoreFlowState & (
      | {
          targetType?: undefined
          targetName?: undefined
        }
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
          targetType?: undefined
          targetName?: undefined
        }
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

export function createRestoreFlowState(records: HistoryRecord[], cwd?: string): RestoreFlowState {
  const currentProjectRecords = records
    .filter((record) => 'projectPath' in record && record.projectPath === cwd)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
  const otherHistoryRecords = records
    .filter((record) => !('projectPath' in record) || record.projectPath !== cwd)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
  const orderedRecords = [...currentProjectRecords, ...otherHistoryRecords]
  const groups: RestoreFlowGroup[] = []

  if (currentProjectRecords.length > 0) {
    groups.push({ title: 'Current project', start: 0, end: currentProjectRecords.length })
  }

  if (otherHistoryRecords.length > 0) {
    groups.push({
      title: 'Other history',
      start: currentProjectRecords.length,
      end: orderedRecords.length,
    })
  }

  return {
    step: 'record',
    records: orderedRecords,
    groups,
  }
}

export function advanceRestoreFlow(
  state: RestoreFlowState,
  action: RestoreFlowAction,
): RestoreFlowState {
  switch (state.step) {
    case 'record': {
      if (action.type !== 'select-record') {
        return state
      }

      const selectedRecord = state.records.find(
        (record) => record.timestamp === action.timestamp,
      )

      if (!selectedRecord) {
        return state
      }

      if (selectedRecord.action === 'init' || selectedRecord.action === 'preset-create') {
        return {
          ...state,
          step: 'confirm',
          selectedTimestamp: action.timestamp,
        }
      }

      return {
        ...state,
        step: 'target',
        selectedTimestamp: action.timestamp,
      }
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

      return {
        ...state,
        step: 'confirm',
        targetType: 'preset',
        targetName: action.targetName as string,
      }

    case 'confirm': {
      if (action.type !== 'confirm' || !state.selectedTimestamp) {
        return state
      }

      const selectedRecord = state.records.find(
        (record) => record.timestamp === state.selectedTimestamp,
      )

      if (selectedRecord?.action === 'init' || selectedRecord?.action === 'preset-create') {
        return {
          ...state,
          step: 'done',
        }
      }

      if (!state.targetType) {
        return state
      }

      if (state.targetType === 'preset' && !state.targetName) {
        return state
      }

      return {
        ...state,
        step: 'done',
      }
    }

    case 'done':
      return state
  }
}
