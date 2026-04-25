import React from 'react'
import { Box, Text } from 'ink'

export function InitApp({
  keys = [],
  requiredKeys = [],
}: {
  keys?: string[]
  requiredKeys?: string[]
}) {
  return (
    <Box flexDirection="column">
      <Text>Move env from Claude settings into managed shell config</Text>
      <Text>Available keys: {keys.join(', ') || 'none'}</Text>
      <Text>Required keys: {requiredKeys.join(', ') || 'none'}</Text>
    </Box>
  )
}
