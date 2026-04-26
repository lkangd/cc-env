import React, { useEffect, useMemo, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'

import { advanceRestoreFlow, type RestoreFlowState } from '../flows/restore-flow.js'
import { EnvEntries, EnvSummary } from './summary.js'

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
  const [cursor, setCursor] = useState(0)
  const recordAtCursor = currentState.records[cursor]
  const selectedRecord = currentState.records.find(
    (record) => record.timestamp === currentState.selectedTimestamp,
  )
  const activeRecord = currentState.step === 'record'
    ? recordAtCursor
    : selectedRecord ?? currentState.records[0]
  const restoreEntries = useMemo(
    () =>
      activeRecord
        ? Object.entries(
            activeRecord.action === 'init'
              ? Object.fromEntries(activeRecord.sources.flatMap((s) => Object.entries(s.backup)))
              : activeRecord.backup,
          ).sort(([left], [right]) => left.localeCompare(right)) as [string, string][]
        : [],
    [activeRecord],
  )

  const fromFiles = useMemo(() => {
    if (!activeRecord || activeRecord.action !== 'init') {
      return []
    }

    return activeRecord.shellWrites.map((sw) => sw.filePath)
  }, [activeRecord])

  const toFiles = useMemo(() => {
    if (!activeRecord || activeRecord.action !== 'init') {
      return []
    }

    return activeRecord.sources.map((s) => s.file)
  }, [activeRecord])

  useEffect(() => {
    setCurrentState(state)
    setCursor(0)
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

    if (currentState.step === 'record') {
      if (key.upArrow || input === 'k') {
        setCursor((value) => Math.max(0, value - 1))
        return
      }

      if (key.downArrow || input === 'j') {
        setCursor((value) => Math.min(currentState.records.length - 1, value + 1))
        return
      }
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
        <>
          <Text dimColor>↑/k ↓/j navigate · enter confirm · q cancel</Text>
          <Box marginTop={1}>
            <Box flexDirection="column" width={28} marginRight={2}>
              <Text bold color="cyan">History</Text>
              <Box flexDirection="column" marginTop={1}>
                {currentState.records.map((record, index) => (
                  <Text key={record.timestamp}>
                    {index === cursor ? '❯ ' : '  '}
                    {record.timestamp}
                  </Text>
                ))}
              </Box>
            </Box>
            <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="green" paddingX={1}>
              <Text bold color="green">Preview</Text>
              {activeRecord?.action === 'init' ? (
                <Box flexDirection="column">
                  {fromFiles.length > 0 ? (
                    <Box flexDirection="column">
                      <Text dimColor>From:</Text>
                      {fromFiles.map((file) => (
                        <Text key={file} color="cyan">  {file}</Text>
                      ))}
                    </Box>
                  ) : null}
                  {toFiles.length > 0 ? (
                    <Box flexDirection="column">
                      <Text dimColor>To:</Text>
                      {toFiles.map((file) => (
                        <Text key={file} color="cyan">  {file}</Text>
                      ))}
                    </Box>
                  ) : null}
                </Box>
              ) : (
                <Text dimColor>
                  Restore to {activeRecord?.targetType === 'preset' ? `preset ${activeRecord.targetName}` : activeRecord?.targetType ?? 'settings'}
                </Text>
              )}
              <Box flexDirection="column" marginTop={1}>
                <EnvEntries entries={restoreEntries} />
              </Box>
            </Box>
          </Box>
        </>
      ) : null}
      {currentState.step === 'target' ? (
        <Text>
          Select target for {selectedRecord?.timestamp ?? 'record'}: settings or preset
        </Text>
      ) : null}
      {currentState.step === 'confirm' && selectedRecord?.action === 'init' ? (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            Confirm restore from <Text color="cyan">{selectedRecord.timestamp}</Text>
          </Text>
          <EnvSummary
            title="Will restore"
            entries={restoreEntries}
            {...(fromFiles.length > 0 ? { fromFiles } : {})}
            {...(toFiles.length > 0 ? { toFiles } : {})}
          />
        </Box>
      ) : null}
      {currentState.step === 'confirm' && selectedRecord?.action !== 'init' ? (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            Confirm restore from <Text color="cyan">{selectedRecord?.timestamp ?? 'record'}</Text> to{' '}
            <Text color="green">
              {currentState.targetType === 'preset'
                ? `preset ${currentState.targetName}`
                : currentState.targetType ?? 'settings'}
            </Text>
          </Text>
          <EnvSummary title="Will restore" entries={restoreEntries} />
        </Box>
      ) : null}
      {currentState.step === 'done' ? (
        <Text color="green">{'\n'}Restore complete</Text>
      ) : null}
      {currentState.step !== 'done' ? (
        <Text>Press Enter to confirm or q to cancel</Text>
      ) : null}
    </Box>
  )
}
