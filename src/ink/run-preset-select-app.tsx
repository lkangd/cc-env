import React, { useMemo, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'

import type { EnvMap } from '../core/schema.js'
import { EnvEntries } from './summary.js'

export type PresetSource = 'global' | 'project'

export type PresetSelectItem = {
  name: string
  env: EnvMap
  source: PresetSource
}

type Props = {
  presets: Array<PresetSelectItem>
  defaultIndex?: number
  onSubmit: (preset: PresetSelectItem) => void
}

export function RunPresetSelectApp({ presets, defaultIndex = 0, onSubmit }: Props) {
  const { exit } = useApp()
  const [cursor, setCursor] = useState(defaultIndex)
  const active = presets[cursor]

  const entries = useMemo(
    () =>
      active
        ? (Object.entries(active.env).sort(([a], [b]) => a.localeCompare(b)) as [string, string][])
        : [],
    [active],
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

    if (key.return && active) {
      onSubmit(active)
      exit()
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold>Select a preset</Text>
      <Text dimColor>↑/k ↓/j navigate · enter select · q cancel</Text>
      <Box marginTop={1}>
        <Box flexDirection="column" width={28} marginRight={2}>
          <Text bold color="cyan">Presets</Text>
          <Box flexDirection="column" marginTop={1}>
            {presets.map((p, i) => (
              <Box key={`${p.source}:${p.name}`}>
                <Text>{i === cursor ? '❯ ' : '  '}</Text>
                <Text {...(p.source === 'project' ? { color: 'yellow' } : {})}>{p.name}</Text>
                <Text dimColor> ({p.source})</Text>
              </Box>
            ))}
          </Box>
        </Box>
        <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="green" paddingX={1}>
          <Text bold color="green">{active?.name ?? 'Preview'}</Text>
          <Text dimColor>{active?.source === 'project' ? 'Project preset' : 'Global preset'}</Text>
          <Box flexDirection="column" marginTop={1}>
            <EnvEntries entries={entries} />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
