import React from 'react'
import { Box, Text } from 'ink'

import type { RestoreFlowState } from '../flows/restore-flow.js'

export function RestoreApp({ state }: { state: RestoreFlowState }) {
  const selectedRecord = state.records.find(
    (record) => record.timestamp === state.selectedTimestamp,
  )

  return (
    <Box flexDirection="column">
      <Text>Restore record</Text>
      {state.step === 'record' ? (
        <Text>
          Select record: {state.records[0]?.timestamp ?? 'no history available'}
        </Text>
      ) : null}
      {state.step === 'target' ? (
        <Text>
          Select target for {selectedRecord?.timestamp ?? 'record'}: settings or preset
        </Text>
      ) : null}
      {state.step === 'confirm' ? (
        <Text>
          Confirm restore from {selectedRecord?.timestamp ?? 'record'} to{' '}
          {state.targetType === 'preset'
            ? `preset ${state.targetName}`
            : state.targetType ?? 'settings'}
        </Text>
      ) : null}
      {state.step === 'done' ? <Text>Restore complete</Text> : null}
    </Box>
  )
}
