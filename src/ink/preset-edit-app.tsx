import React, { useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import type { EnvMap } from '../core/schema.js'

import { useTextInput } from './hooks/use-text-input.js'
import { TextInputDisplay } from './components/text-input.js'

type PresetEditAppProps = {
  name: string
  env: EnvMap
  onSubmit: (result: { env: EnvMap; confirmed: boolean }) => void
}

export function PresetEditApp({ name, env: initialEnv, onSubmit }: PresetEditAppProps) {
  const { exit } = useApp()
  const [entries, setEntries] = useState<[string, string][]>(Object.entries(initialEnv))
  const [cursor, setCursor] = useState(0)
  const [editing, setEditing] = useState<number | null>(null)
  const textInput = useTextInput()
  const [error, setError] = useState<string | undefined>()
  const [step, setStep] = useState<'list' | 'confirm'>('list')

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      if (editing !== null) {
        setEditing(null)
        textInput.reset()
        setError(undefined)
        return
      }
      onSubmit({ env: initialEnv, confirmed: false })
      exit()
      return
    }

    if (step === 'list' && editing === null) {
      if (key.upArrow || input === 'k') {
        setCursor((c) => Math.max(0, c - 1))
        return
      }
      if (key.downArrow || input === 'j') {
        setCursor((c) => Math.min(entries.length - 1, c + 1))
        return
      }
      if (key.return && entries.length > 0) {
        const entry = entries[cursor]
        if (entry) {
          textInput.reset(`${entry[0]}=${entry[1]}`)
          setEditing(cursor)
          setError(undefined)
        }
        return
      }
      if (input === 'd' && entries.length > 0) {
        setEntries((prev) => prev.filter((_, i) => i !== cursor))
        setCursor((c) => Math.max(0, c - 1))
        return
      }
      if (input === 'a') {
        textInput.reset()
        setEditing(entries.length)
        setError(undefined)
        return
      }
      if (input === 's') {
        setStep('confirm')
        return
      }
    }

    if (editing !== null) {
      if (key.return) {
        const sep = textInput.value.indexOf('=')
        if (sep <= 0) {
          setError('Format must be KEY=VALUE')
          return
        }
        const k = textInput.value.slice(0, sep)
        const v = textInput.value.slice(sep + 1)
        if (!/^[A-Z0-9_]+$/.test(k)) {
          setError('Key must match [A-Z0-9_]+')
          return
        }
        setEntries((prev) => {
          const next = [...prev]
          if (editing < prev.length) {
            next[editing] = [k, v]
          } else {
            next.push([k, v])
          }
          return next
        })
        setEditing(null)
        textInput.reset()
        setError(undefined)
        return
      }
      if (textInput.handleKey(input, key)) return
    }

    if (step === 'confirm') {
      if (key.return) {
        const env: EnvMap = Object.fromEntries(entries)
        onSubmit({ env, confirmed: true })
        exit()
        return
      }
      if (input === 'q') {
        setStep('list')
        return
      }
    }
  })

  if (step === 'confirm') {
    return (
      <Box flexDirection="column">
        <Text bold>Save changes to preset "{name}"?</Text>
        <Box flexDirection="column" marginTop={1}>
          {entries.map(([k, v]) => (
            <Box key={k}>
              <Text color="yellow">• </Text>
              <Text color="magenta">{k}</Text>
              <Text dimColor>=</Text>
              <Text>{v}</Text>
            </Box>
          ))}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press enter to confirm · q to go back</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold>Editing preset: {name}</Text>
      <Text dimColor>↑/k ↓/j navigate · enter edit · d delete · a add · s save · q cancel</Text>
      <Box flexDirection="column" marginTop={1}>
        {entries.map(([k, v], i) => (
          <Box key={k}>
            <Text>{i === cursor ? '❯ ' : '  '}</Text>
            <Text color="magenta">{k}</Text>
            <Text dimColor>=</Text>
            <Text>{v}</Text>
          </Box>
        ))}
        {entries.length === 0 && <Text dimColor>No entries. Press a to add.</Text>}
      </Box>
      {editing !== null && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>{editing < entries.length ? 'Edit entry' : 'Add entry'}</Text>
          <TextInputDisplay value={textInput.value} cursorPos={textInput.cursorPos} />
          {error ? <Text color="red">{error}</Text> : null}
        </Box>
      )}
    </Box>
  )
}
