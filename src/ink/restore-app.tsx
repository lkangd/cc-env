import React, { useEffect, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'

import { formatRestorePreview } from '../core/format.js'
import { advanceRestoreFlow, type RestoreFlowState } from '../flows/restore-flow.js'

export function RestoreApp({
  state,
  onSubmit,
}: {
  state: RestoreFlowState
  onSubmit?: (result: {
    confirmed: boolean
    timestamp?: string
    targetType?: 'settings' | 'preset'
    targetName?: string
  }) => void
}) {
  const { exit } = useApp()
  const [currentState, setCurrentState] = useState(state)
  const selectedRecord = currentState.records.find(
    (record) => record.timestamp === currentState.selectedTimestamp,
  )
  const activeRecord = selectedRecord ?? currentState.records[0]
  const restorePreview = activeRecord
    ? formatRestorePreview(
        activeRecord.action === 'init'
          ? {
              ...activeRecord.settingsBackup,
              ...activeRecord.settingsLocalBackup,
            }
          : activeRecord.backup,
      )
    : ''

  useEffect(() => {
    setCurrentState(state)
  }, [state])

  useEffect(() => {
    if (!onSubmit || currentState.records.length !== 0) {
      return
    }

    onSubmit({
      confirmed: false,
    })
    exit()
  }, [currentState.records.length, exit, onSubmit])

  useInput((input, key) => {
    if (!onSubmit) {
      return
    }

    if (key.escape || input.toLowerCase() === 'q') {
      onSubmit({ confirmed: false })
      exit()
      return
    }

    if (!key.return || !activeRecord) {
      return
    }

    if (currentState.step === 'record') {
      setCurrentState((previousState) =>
        advanceRestoreFlow(previousState, {
          type: 'select-record',
          timestamp: activeRecord.timestamp,
        }),
      )
      return
    }

    if (currentState.step === 'target') {
      if (activeRecord.action !== 'restore') {
        return
      }

      setCurrentState((previousState) =>
        advanceRestoreFlow(previousState, {
          type: 'select-target',
          targetType: activeRecord.targetType,
          ...(activeRecord.targetType === 'preset'
            ? { targetName: activeRecord.targetName }
            : {}),
        }),
      )
      return
    }

    if (currentState.step === 'confirm') {
      onSubmit({
        confirmed: true,
        timestamp: activeRecord.timestamp,
        ...(currentState.targetType ? { targetType: currentState.targetType } : {}),
        ...(currentState.targetType === 'preset' && 'targetName' in currentState
          ? { targetName: currentState.targetName }
          : {}),
      })
      exit()
    }
  })

  return (
    <Box flexDirection="column">
      <Text>Restore record</Text>
      {currentState.step === 'record' ? (
        <Text>
          Select record: {currentState.records[0]?.timestamp ?? 'no history available'}
        </Text>
      ) : null}
      {currentState.step === 'target' ? (
        <Text>
          Select target for {selectedRecord?.timestamp ?? 'record'}: settings or preset
        </Text>
      ) : null}
      {currentState.step === 'confirm' && selectedRecord?.action === 'init' ? (
        <>
          <Text>
            Confirm restore from {selectedRecord.timestamp} to Claude settings files and shell config
          </Text>
          <Text>Will restore:</Text>
          <Text>{restorePreview || 'none'}</Text>
        </>
      ) : null}
      {currentState.step === 'confirm' && selectedRecord?.action !== 'init' ? (
        <>
          <Text>
            Confirm restore from {selectedRecord?.timestamp ?? 'record'} to{' '}
            {currentState.targetType === 'preset'
              ? `preset ${currentState.targetName}`
              : currentState.targetType ?? 'settings'}
          </Text>
          <Text>Will restore:</Text>
          <Text>{restorePreview || 'none'}</Text>
        </>
      ) : null}
      {currentState.step === 'done' ? <Text>Restore complete</Text> : null}
      <Text>Press Enter to confirm or q to cancel</Text>
    </Box>
  )
}
