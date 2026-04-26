import React, { useMemo, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'

import type { EnvMap } from '../core/schema.js'
import { EnvEntries } from './summary.js'

type PresetSource = 'global' | 'project'

export type PresetDeleteItem = {
  name: string
  env: EnvMap
  source: PresetSource
}

type DeleteStep = 'browsing' | 'confirming'

export function PresetDeleteApp({
  presets,
  onSubmit,
}: {
  presets: Array<PresetDeleteItem>
  onSubmit: (preset: PresetDeleteItem) => void
}) {
  const { exit } = useApp()
  const [cursor, setCursor] = useState(0)
  const [step, setStep] = useState<DeleteStep>('browsing')

  const activePreset = presets[cursor]

  const entries = useMemo(
    () =>
      activePreset
        ? (Object.entries(activePreset.env).sort(([a], [b]) => a.localeCompare(b)) as [string, string][])
        : [],
    [activePreset],
  )

  useInput((input, key) => {
    if (step === 'browsing') {
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

      if (key.return) {
        setStep('confirming')
        return
      }
    }

    if (step === 'confirming') {
      if (input.toLowerCase() === 'y') {
        onSubmit(activePreset!)
        exit()
        return
      }

      if (input.toLowerCase() === 'n' || key.escape) {
        setStep('browsing')
        return
      }
    }
  })

  return (
    <Box flexDirection="column">
      <Text>Preset delete</Text>
      <Text dimColor>
        {step === 'browsing'
          ? '↑/k ↓/j navigate · Enter select · q exit'
          : 'y confirm · n cancel'}
      </Text>
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
        <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="red" paddingX={1}>
          <Text bold color="red">{activePreset!.name}</Text>
          <Text dimColor>{activePreset!.source === 'project' ? 'Project preset' : 'Global preset'}</Text>
          <Box flexDirection="column" marginTop={1}>
            <EnvEntries entries={entries} />
          </Box>
        </Box>
      </Box>
      {step === 'confirming' && (
        <Box marginTop={1}>
          <Text color="red">Delete preset </Text>
          <Text bold>{activePreset!.name}</Text>
          <Text color="red">?</Text>
          <Text dimColor> y/n</Text>
        </Box>
      )}
    </Box>
  )
}
