import React, { useEffect } from 'react'
import { Box, Text, useApp, useInput } from 'ink'

export function InitApp({
  keys = [],
  requiredKeys = [],
  onSubmit,
}: {
  keys?: string[]
  requiredKeys?: string[]
  onSubmit?: (result: { confirmed: boolean; selectedKeys: string[] }) => void
}) {
  const { exit } = useApp()

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

    if (key.return) {
      onSubmit({ confirmed: true, selectedKeys: requiredKeys })
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
      <Text>Move env from Claude settings into managed shell config</Text>
      <Text>Available keys: {keys.join(', ') || 'none'}</Text>
      <Text>Required keys: {requiredKeys.join(', ') || 'none'}</Text>
      <Text>Press Enter to confirm or q to cancel</Text>
    </Box>
  )
}
