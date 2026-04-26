import React, { useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'

import {
  advancePresetCreateFlow,
  createPresetCreateFlowState,
  type PresetCreateDestination,
  type PresetCreateFlowResult,
  type PresetCreateSource,
} from '../flows/preset-create-flow.js'
import type { EnvMap } from '../core/schema.js'
import { EnvSummary } from './summary.js'

export type PresetCreateAppResult = PresetCreateFlowResult & {
  destination: PresetCreateDestination
}

type PresetCreateAppProps = {
  onSubmit: (result: PresetCreateAppResult) => Promise<void> | void
  readFile: (filePath: string) => Promise<{ allKeys: string[]; env: EnvMap }>
  globalPresetPath: (name: string) => string
  projectEnvPath: string
}

function SourceStep({ cursor }: { cursor: number }) {
  const options: { label: string; value: PresetCreateSource }[] = [
    { label: 'File import', value: 'file' },
    { label: 'Manual input', value: 'manual' },
  ]
  return (
    <Box flexDirection="column">
      <Text bold>Select env source</Text>
      <Text dimColor>↑/k ↓/j navigate · enter confirm</Text>
      <Box flexDirection="column" marginTop={1}>
        {options.map((opt, i) => (
          <Box key={opt.value}>
            <Text>{i === cursor ? '❯ ' : '  '}</Text>
            <Text {...(i === cursor ? { color: 'cyan' } : {})}>{opt.label}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function FilePathStep({ value, error }: { value: string; error?: string }) {
  return (
    <Box flexDirection="column">
      <Text bold>Enter file path (.yaml/.yml/.json)</Text>
      <Box marginTop={1}>
        <Text dimColor>{'>'} </Text>
        <Text color="cyan">{value}</Text>
        <Text dimColor>█</Text>
      </Box>
      {error ? <Text color="red">{error}</Text> : null}
    </Box>
  )
}

function KeysStep({
  keys,
  selectedKeys,
  cursor,
}: {
  keys: string[]
  selectedKeys: string[]
  cursor: number
}) {
  return (
    <Box flexDirection="column">
      <Text bold>Select env keys to import</Text>
      <Text dimColor>↑/k ↓/j navigate · space toggle · enter confirm</Text>
      <Box flexDirection="column" marginTop={1}>
        {keys.map((key, i) => {
          const isSelected = selectedKeys.includes(key)
          return (
            <Box key={key}>
              <Text>{i === cursor ? '❯ ' : '  '}</Text>
              <Text color={isSelected ? 'green' : ''}>{isSelected ? '[x]' : '[ ]'}</Text>
              <Text> {key}</Text>
            </Box>
          )
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{selectedKeys.length} of {keys.length} selected</Text>
      </Box>
    </Box>
  )
}

function ManualInputStep({
  entries,
  value,
  error,
}: {
  entries: [string, string][]
  value: string
  error?: string
}) {
  return (
    <Box flexDirection="column">
      <Text bold>Enter KEY=VALUE pairs (press q when done)</Text>
      {entries.length > 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          {entries.map(([key, val]) => (
            <Box key={key}>
              <Text color="yellow">• </Text>
              <Text color="magenta">{key}</Text>
              <Text dimColor>=</Text>
              <Text>{val}</Text>
            </Box>
          ))}
        </Box>
      ) : null}
      <Box>
        <Text dimColor>{'>'} </Text>
        <Text color="cyan">{value}</Text>
        <Text dimColor>█</Text>
      </Box>
      {error ? <Text color="red">{error}</Text> : null}
    </Box>
  )
}

function NameStep({ value }: { value: string }) {
  return (
    <Box flexDirection="column">
      <Text bold>Enter preset name</Text>
      <Box marginTop={1}>
        <Text dimColor>{'>'} </Text>
        <Text color="cyan">{value}</Text>
        <Text dimColor>█</Text>
      </Box>
    </Box>
  )
}

function DestinationStep({ cursor }: { cursor: number }) {
  const options: { label: string; value: PresetCreateDestination }[] = [
    { label: 'Global preset', value: 'global' },
    { label: 'Project preset', value: 'project' },
  ]
  return (
    <Box flexDirection="column">
      <Text bold>Select save destination</Text>
      <Text dimColor>↑/k ↓/j navigate · enter confirm</Text>
      <Box flexDirection="column" marginTop={1}>
        {options.map((opt, i) => (
          <Box key={opt.value}>
            <Text>{i === cursor ? '❯ ' : '  '}</Text>
            <Text {...(i === cursor ? { color: 'cyan' } : {})}>{opt.label}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export function PresetCreateApp({
  onSubmit,
  readFile,
  globalPresetPath,
  projectEnvPath,
}: PresetCreateAppProps) {
  const { exit } = useApp()
  const [state, setState] = useState(createPresetCreateFlowState)
  const [textInput, setTextInput] = useState('')
  const [listCursor, setListCursor] = useState(0)
  const [allKeys, setAllKeys] = useState<string[]>([])
  const [fileEnv, setFileEnv] = useState<EnvMap>({})

  useInput((input, key) => {
    if (key.escape) {
      exit()
      return
    }

    if (state.step === 'source') {
      if (input === 'q') {
        exit()
        return
      }
      if (key.upArrow || input === 'k') {
        setListCursor((c) => Math.max(0, c - 1))
        return
      }
      if (key.downArrow || input === 'j') {
        setListCursor((c) => Math.min(1, c + 1))
        return
      }
      if (key.return) {
        const source: PresetCreateSource = listCursor === 0 ? 'file' : 'manual'
        setState((s) => advancePresetCreateFlow(s, { type: 'select-source', source }))
        setListCursor(0)
        setTextInput('')
        return
      }
    }

    if (state.step === 'filePath') {
      if (input === 'q') {
        exit()
        return
      }
      if (key.backspace || key.delete) {
        setTextInput((v) => v.slice(0, -1))
        return
      }
      if (key.return) {
        void (async () => {
          try {
            const result = await readFile(textInput)
            if (result.allKeys.length === 0) {
              setState((s) => advancePresetCreateFlow(s, {
                type: 'set-error',
                error: 'No valid env keys found in file',
              }))
              return
            }
            setAllKeys(result.allKeys)
            setFileEnv(result.env)
            setState((s) => advancePresetCreateFlow(s, {
              type: 'set-file-path',
              filePath: textInput,
            }))
            setListCursor(0)
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to read file'
            setState((s) => advancePresetCreateFlow(s, {
              type: 'set-error',
              error: message,
            }))
          }
        })()
        return
      }
      if (input && !key.ctrl && !key.meta) {
        setTextInput((v) => v + input)
        return
      }
    }

    if (state.step === 'keys') {
      if (input === 'q') {
        exit()
        return
      }
      if (key.upArrow || input === 'k') {
        setListCursor((c) => Math.max(0, c - 1))
        return
      }
      if (key.downArrow || input === 'j') {
        setListCursor((c) => Math.min(allKeys.length - 1, c + 1))
        return
      }
      if (input === ' ') {
        const targetKey = allKeys[listCursor]
        if (targetKey) {
          const newSelected = state.selectedKeys.includes(targetKey)
            ? state.selectedKeys.filter((k) => k !== targetKey)
            : [...state.selectedKeys, targetKey]
          setState((s) => ({ ...s, selectedKeys: newSelected }))
        }
        return
      }
      if (key.return && state.selectedKeys.length > 0) {
        const selectedEnv: EnvMap = {}
        for (const k of state.selectedKeys) {
          selectedEnv[k] = fileEnv[k] ?? ''
        }
        setState((s) => advancePresetCreateFlow(s, {
          type: 'select-keys',
          keys: state.selectedKeys,
          env: selectedEnv,
        }))
        setTextInput('')
        return
      }
    }

    if (state.step === 'manualInput') {
      if (input === 'q' && textInput === '') {
        if (state.selectedKeys.length === 0) {
          setState((s) => advancePresetCreateFlow(s, {
            type: 'set-error',
            error: 'Add at least one KEY=VALUE pair',
          }))
          return
        }
        setState((s) => advancePresetCreateFlow(s, { type: 'finish-manual-input' }))
        setTextInput('')
        return
      }
      if (key.backspace || key.delete) {
        setTextInput((v) => v.slice(0, -1))
        return
      }
      if (key.return) {
        const separatorIndex = textInput.indexOf('=')
        if (separatorIndex <= 0) {
          setState((s) => advancePresetCreateFlow(s, {
            type: 'set-error',
            error: 'Format must be KEY=VALUE',
          }))
          return
        }
        const k = textInput.slice(0, separatorIndex)
        const v = textInput.slice(separatorIndex + 1)
        if (!/^[A-Z0-9_]+$/.test(k)) {
          setState((s) => advancePresetCreateFlow(s, {
            type: 'set-error',
            error: 'Key must match [A-Z0-9_]+',
          }))
          return
        }
        setState((s) => advancePresetCreateFlow(s, {
          type: 'add-manual-pair',
          key: k,
          value: v,
        }))
        setTextInput('')
        return
      }
      if (input && !key.ctrl && !key.meta) {
        setTextInput((v) => v + input)
        return
      }
    }

    if (state.step === 'name') {
      if (input === 'q') {
        exit()
        return
      }
      if (key.backspace || key.delete) {
        setTextInput((v) => v.slice(0, -1))
        return
      }
      if (key.return && textInput.trim().length > 0) {
        setState((s) => advancePresetCreateFlow(s, {
          type: 'set-name',
          name: textInput.trim(),
        }))
        setListCursor(0)
        return
      }
      if (input && !key.ctrl && !key.meta) {
        setTextInput((v) => v + input)
        return
      }
    }

    if (state.step === 'destination') {
      if (input === 'q') {
        exit()
        return
      }
      if (key.upArrow || input === 'k') {
        setListCursor((c) => Math.max(0, c - 1))
        return
      }
      if (key.downArrow || input === 'j') {
        setListCursor((c) => Math.min(1, c + 1))
        return
      }
      if (key.return) {
        const destination: PresetCreateDestination = listCursor === 0 ? 'global' : 'project'
        setState((s) => advancePresetCreateFlow(s, {
          type: 'select-destination',
          destination,
        }))
        return
      }
    }

    if (state.step === 'confirm') {
      if (input === 'q') {
        exit()
        return
      }
      if (key.return && state.destination && state.presetName) {
        const doneState = advancePresetCreateFlow(state, { type: 'confirm' })
        setState(doneState)
        void Promise.resolve(
          onSubmit({
            source: state.source!,
            filePath: state.filePath,
            env: state.env,
            selectedKeys: state.selectedKeys,
            presetName: state.presetName,
            destination: state.destination,
          }),
        ).finally(() => {
          exit()
        })
      }
    }
  })

  if (state.step === 'done') {
    return (
      <Box flexDirection="column">
        <Text color="green">Done</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {state.step === 'source' && <SourceStep cursor={listCursor} />}
      {state.step === 'filePath' && (
        <FilePathStep value={textInput} {...(state.error ? { error: state.error } : {})} />
      )}
      {state.step === 'keys' && (
        <KeysStep keys={allKeys} selectedKeys={state.selectedKeys} cursor={listCursor} />
      )}
      {state.step === 'manualInput' && (
        <ManualInputStep
          entries={state.selectedKeys.map((k) => [k, state.env[k] ?? ''] as [string, string])}
          value={textInput}
          {...(state.error ? { error: state.error } : {})}
        />
      )}
      {state.step === 'name' && <NameStep value={textInput} />}
      {state.step === 'destination' && <DestinationStep cursor={listCursor} />}
      {state.step === 'confirm' && state.destination ? (
        <Box flexDirection="column">
          <EnvSummary
            title={`Preset: ${state.presetName}`}
            entries={
              Object.entries(state.env)
                .filter(([k]) => state.selectedKeys.includes(k))
                .sort(([a], [b]) => a.localeCompare(b)) as [string, string][]
            }
            mask
            {...(state.filePath ? { fromFiles: [state.filePath] } : {})}
            toFiles={[
              state.destination === 'global'
                ? globalPresetPath(state.presetName)
                : projectEnvPath,
            ]}
          />
          <Box marginTop={1}>
            <Text dimColor>Press enter to confirm · q to cancel</Text>
          </Box>
        </Box>
      ) : null}
    </Box>
  )
}
