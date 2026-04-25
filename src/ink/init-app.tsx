import React, { useEffect, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'

import {
  advanceInitFlow,
  createInitFlowState,
} from '../flows/init-flow.js'

export function InitApp({
  keys = [],
  requiredKeys = [],
  sourceFiles = [],
  onSubmit,
}: {
  keys?: string[]
  requiredKeys?: string[]
  sourceFiles?: string[]
  onSubmit?: (result: { confirmed: boolean; selectedKeys: string[] }) => void
}) {
  const { exit } = useApp()
  const [cursor, setCursor] = useState(0)
  const [flowState, setFlowState] = useState(() =>
    createInitFlowState(keys, requiredKeys),
  )

  useEffect(() => {
    if (!onSubmit) {
      return
    }

    if (keys.length === 0) {
      onSubmit({ confirmed: false, selectedKeys: [] })
      exit()
    }
  }, [exit, keys.length, onSubmit])

  useInput((input, key) => {
    if (!onSubmit) {
      return
    }

    if (key.upArrow || input === 'k') {
      setCursor((c) => Math.max(0, c - 1))
      return
    }

    if (key.downArrow || input === 'j') {
      setCursor((c) => Math.min(keys.length - 1, c + 1))
      return
    }

    if (input === ' ') {
      const targetKey = keys[cursor]
      if (targetKey) {
        setFlowState((prev) =>
          advanceInitFlow(prev, { type: 'toggle-key', key: targetKey }),
        )
      }
      return
    }

    if (key.return) {
      onSubmit({ confirmed: true, selectedKeys: flowState.selectedKeys })
      exit()
      return
    }

    if (key.escape || input.toLowerCase() === 'q') {
      onSubmit({ confirmed: false, selectedKeys: [] })
      exit()
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold>Select env keys to migrate into managed shell config</Text>
      {sourceFiles.length > 0 ? (
        <Box flexDirection="column">
          <Text dimColor>Source:</Text>
          {sourceFiles.map((file) => (
            <Text key={file} color="cyan">  {file}</Text>
          ))}
        </Box>
      ) : null}
      <Text dimColor>↑/k ↓/j navigate · space toggle · enter confirm · q cancel</Text>
      <Box flexDirection="column" marginTop={1}>
        {keys.map((key, i) => {
          const isRequired = requiredKeys.includes(key)
          const isSelected = flowState.selectedKeys.includes(key)
          const isCursor = i === cursor
          const checkbox = isSelected ? '[x]' : '[ ]'

          return (
            <Box key={key}>
              <Text>{isCursor ? '❯ ' : '  '}</Text>
              <Text color={isSelected ? 'green' : ''}>{checkbox}</Text>
              <Text> {key}</Text>
              {isRequired ? <Text dimColor> (required)</Text> : null}
            </Box>
          )
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {flowState.selectedKeys.length} of {keys.length} selected
        </Text>
      </Box>
    </Box>
  )
}
