import React from 'react'
import { Box, Text } from 'ink'

type TextInputDisplayProps = {
  value: string
  cursorPos: number
}

export function TextInputDisplay({ value, cursorPos }: TextInputDisplayProps) {
  const before = value.slice(0, cursorPos)
  const after = value.slice(cursorPos)
  return (
    <Box>
      <Text dimColor>{'>'} </Text>
      <Text color="cyan">{before}</Text>
      <Text dimColor>█</Text>
      <Text color="cyan">{after}</Text>
    </Box>
  )
}
