import React, { useMemo, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'

import type { EnvMap } from '../core/schema.js'
import { EnvEntries } from './summary.js'

export type PresetSource = 'global' | 'project'

export type PresetShowItem = {
  name: string
  env: EnvMap
  source: PresetSource
}

export function PresetShowApp({
  presets,
}: {
  presets: Array<PresetShowItem>
}) {
  const { exit } = useApp()
  const [cursor, setCursor] = useState(0)
  const activePreset = presets[cursor]

  const entries = useMemo(
    () =>
      activePreset
        ? (Object.entries(activePreset.env).sort(([a], [b]) => a.localeCompare(b)) as [string, string][])
        : [],
    [activePreset],
  )

  useInput((input, key) => {
    if (key.escape || input.toLowerCase() === 'q') {
      exit()
      return
    }

    if (key.upArrow || input === 'k') {
      setCursor((c) => Math.max(0, c - 1))
      return
    }

    if (key.downArrow || input === 'j') {
      setCursor((c) => Math.min(presets.length - 1, c + 1))
      return
    }
  })

  return (
    <Box flexDirection="column">
      <Text>Preset show</Text>
      <Text dimColor>↑/k ↓/j navigate · q exit</Text>
      <Box marginTop={1}>
        <Box flexDirection="column" width={28} marginRight={2}>
          <Text bold color="cyan">Presets</Text>
          <Box flexDirection="column" marginTop={1}>
            {presets.map((preset, index) => (
              <Box key={`${preset.source}:${preset.name}`}>
                <Text>{index === cursor ? '❯ ' : '  '}</Text>
                <Text {...(preset.source === 'project' ? { color: 'yellow' } : {})}>{preset.name}</Text>
                <Text dimColor> ({preset.source})</Text>
              </Box>
            ))}
          </Box>
        </Box>
        <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="green" paddingX={1}>
          <Text bold color="green">{activePreset?.name ?? 'Preview'}</Text>
          <Text dimColor>{activePreset?.source === 'project' ? 'Project preset' : 'Global preset'}</Text>
          <Box flexDirection="column" marginTop={1}>
            <EnvEntries entries={entries} />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
