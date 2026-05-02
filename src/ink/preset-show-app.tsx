import React, { useMemo, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'

import type { EnvMap } from '../core/schema.js'
import { PresetEditApp } from './preset-edit-app.js'
import { TextInputDisplay } from './components/text-input.js'
import { useTextInput } from './hooks/use-text-input.js'
import { EnvEntries } from './summary.js'

export type PresetSource = 'global' | 'project'

export type PresetShowItem = {
  name: string
  env: EnvMap
  source: PresetSource
}

export type PresetShowAction =
  | { type: 'exit' }
  | { type: 'delete'; preset: PresetShowItem }
  | { type: 'edit'; preset: PresetShowItem; result: { env: EnvMap; confirmed: boolean } }
  | { type: 'rename'; preset: PresetShowItem; nextName: string; confirmed: boolean }
  | { type: 'open-directory'; preset: PresetShowItem }

type Step = 'list' | 'rename' | 'confirm-delete' | 'confirm-rename' | 'edit'

export function PresetShowApp({
  presets,
  onSubmit,
}: {
  presets: Array<PresetShowItem>
  onSubmit: (action: PresetShowAction) => void
}) {
  const { exit } = useApp()
  const [cursor, setCursor] = useState(0)
  const [step, setStep] = useState<Step>('list')
  const [renameError, setRenameError] = useState<string | undefined>()
  const textInput = useTextInput()
  const activePreset = presets[cursor]

  const entries = useMemo(
    () =>
      activePreset
        ? (Object.entries(activePreset.env).sort(([a], [b]) => a.localeCompare(b)) as [string, string][])
        : [],
    [activePreset],
  )

  useInput((input, key) => {
    if (step === 'list') {
      if (key.escape || input.toLowerCase() === 'q') {
        onSubmit({ type: 'exit' })
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

      if (input === 'o' && activePreset) {
        onSubmit({ type: 'open-directory', preset: activePreset })
        exit()
        return
      }

      if (input === 'd' && activePreset) {
        setStep('confirm-delete')
        return
      }

      if (input === 'r' && activePreset) {
        textInput.reset(activePreset.name)
        setRenameError(undefined)
        setStep('rename')
        return
      }

      if (input === 'e' && activePreset) {
        setStep('edit')
      }
      return
    }

    if (step === 'rename') {
      if (key.escape || input.toLowerCase() === 'q') {
        setStep('list')
        textInput.reset()
        setRenameError(undefined)
        return
      }

      if (key.return) {
        const nextName = textInput.value.trim()
        if (!nextName) {
          setRenameError('Name cannot be empty')
          return
        }
        if (nextName === activePreset?.name) {
          setRenameError('New name must be different from the current name')
          return
        }
        setRenameError(undefined)
        setStep('confirm-rename')
        return
      }

      if (textInput.handleKey(input, key)) return
      return
    }

    if (step === 'confirm-delete') {
      if (input.toLowerCase() === 'y' && activePreset) {
        onSubmit({ type: 'delete', preset: activePreset })
        exit()
        return
      }

      if (input.toLowerCase() === 'n' || key.escape) {
        setStep('list')
        return
      }
      return
    }

    if (step === 'confirm-rename') {
      if (input.toLowerCase() === 'y' && activePreset) {
        onSubmit({ type: 'rename', preset: activePreset, nextName: textInput.value.trim(), confirmed: true })
        exit()
        return
      }

      if (input.toLowerCase() === 'n' || key.escape) {
        setStep('list')
        textInput.reset()
        setRenameError(undefined)
        return
      }
    }
  })

  if (step === 'edit' && activePreset) {
    return (
      <PresetEditApp
        name={activePreset.name}
        env={activePreset.env}
        onSubmit={(result) => {
          onSubmit({ type: 'edit', preset: activePreset, result })
          exit()
        }}
      />
    )
  }

  return (
    <Box flexDirection="column">
      <Text>Preset show</Text>
      <Text dimColor>↑/k ↓/j navigate · o open · e edit · r rename · d delete · q exit</Text>
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
      {step === 'rename' && activePreset ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Rename preset: {activePreset.name}</Text>
          <TextInputDisplay value={textInput.value} cursorPos={textInput.cursorPos} />
          {renameError ? <Text color="red">{renameError}</Text> : null}
          <Text dimColor>Press enter to continue · q to cancel</Text>
        </Box>
      ) : null}
      {step === 'confirm-delete' && activePreset ? (
        <Box marginTop={1}>
          <Text color="red">Delete preset </Text>
          <Text bold>{activePreset.name}</Text>
          <Text color="red"> ({activePreset.source})?</Text>
          <Text dimColor> y/n</Text>
        </Box>
      ) : null}
      {step === 'confirm-rename' && activePreset ? (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            Rename preset <Text bold>{activePreset.name}</Text> → <Text bold>{textInput.value.trim()}</Text>
          </Text>
          <Text dimColor>Press y to confirm · n to cancel</Text>
        </Box>
      ) : null}
    </Box>
  )
}
