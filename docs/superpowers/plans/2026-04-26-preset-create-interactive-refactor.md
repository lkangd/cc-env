# Preset Create Interactive Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `preset create` from a semi-interactive command with CLI flags to a fully interactive ink UI wizard.

**Architecture:** Extend the existing `preset-create-flow.ts` state machine with new conditional steps (filePath, manualInput, name). Rewrite `preset-create-app.tsx` to render each step with appropriate ink UI. Simplify `commands/preset/create.ts` to a thin wrapper that calls `renderFlow` and writes the result. Update `cli.ts` to remove all flags.

**Tech Stack:** TypeScript, React 19, ink v6, zod v4, yaml

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Rewrite | `src/flows/preset-create-flow.ts` | 7-step state machine with conditional paths |
| Rewrite | `src/ink/preset-create-app.tsx` | Multi-step ink UI for all 7 steps |
| Rewrite | `src/commands/preset/create.ts` | Thin command that calls renderFlow + writes result |
| Modify | `src/cli.ts:235-266` | Remove flags, update renderFlow wiring |
| Rewrite | `tests/flows/preset-create-flow.test.ts` | Tests for new flow paths |
| Rewrite | `tests/commands/create.test.ts` | Tests for new command function |

---

### Task 1: Rewrite the flow state machine

**Files:**
- Rewrite: `src/flows/preset-create-flow.ts`
- Rewrite: `tests/flows/preset-create-flow.test.ts`

- [ ] **Step 1: Write the new flow types and state factory**

Replace the entire content of `src/flows/preset-create-flow.ts`:

```typescript
import type { EnvMap } from '../core/schema.js'

export type PresetCreateSource = 'file' | 'manual'
export type PresetCreateDestination = 'global' | 'project'

export type PresetCreateStep =
  | 'source'
  | 'filePath'
  | 'keys'
  | 'manualInput'
  | 'name'
  | 'destination'
  | 'confirm'
  | 'done'

export type PresetCreateFlowState = {
  step: PresetCreateStep
  source?: PresetCreateSource
  filePath?: string
  env: EnvMap
  allKeys: string[]
  selectedKeys: string[]
  presetName: string
  destination?: PresetCreateDestination
  error?: string
}

export type PresetCreateFlowResult = Pick<
  PresetCreateFlowState,
  'source' | 'filePath' | 'env' | 'selectedKeys' | 'presetName' | 'destination'
>

export type PresetCreateFlowAction =
  | { type: 'select-source'; source: PresetCreateSource }
  | { type: 'set-file-path'; filePath: string }
  | { type: 'set-error'; error: string }
  | { type: 'select-keys'; keys: string[]; env: EnvMap }
  | { type: 'add-manual-pair'; key: string; value: string }
  | { type: 'finish-manual-input' }
  | { type: 'set-name'; name: string }
  | { type: 'select-destination'; destination: PresetCreateDestination }
  | { type: 'confirm' }

export function createPresetCreateFlowState(): PresetCreateFlowState {
  return {
    step: 'source',
    env: {},
    allKeys: [],
    selectedKeys: [],
    presetName: '',
  }
}

export function advancePresetCreateFlow(
  state: PresetCreateFlowState,
  action: PresetCreateFlowAction,
): PresetCreateFlowState {
  switch (state.step) {
    case 'source':
      if (action.type !== 'select-source') return state
      return {
        ...state,
        step: action.source === 'file' ? 'filePath' : 'manualInput',
        source: action.source,
      }

    case 'filePath':
      if (action.type === 'set-error') {
        return { ...state, error: action.error }
      }
      if (action.type !== 'set-file-path') return state
      return {
        ...state,
        step: 'keys',
        filePath: action.filePath,
        error: undefined,
      }

    case 'keys':
      if (action.type !== 'select-keys') return state
      return {
        ...state,
        step: 'name',
        selectedKeys: action.keys,
        env: action.env,
      }

    case 'manualInput':
      if (action.type === 'add-manual-pair') {
        return {
          ...state,
          env: { ...state.env, [action.key]: action.value },
          selectedKeys: [...state.selectedKeys, action.key],
          error: undefined,
        }
      }
      if (action.type === 'set-error') {
        return { ...state, error: action.error }
      }
      if (action.type !== 'finish-manual-input') return state
      return { ...state, step: 'name' }

    case 'name':
      if (action.type !== 'set-name') return state
      return {
        ...state,
        step: 'destination',
        presetName: action.name,
      }

    case 'destination':
      if (action.type !== 'select-destination') return state
      return {
        ...state,
        step: 'confirm',
        destination: action.destination,
      }

    case 'confirm':
      if (action.type !== 'confirm') return state
      return { ...state, step: 'done' }

    case 'done':
      return state
  }
}
```

- [ ] **Step 2: Write flow tests**

Replace the entire content of `tests/flows/preset-create-flow.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

import {
  advancePresetCreateFlow,
  createPresetCreateFlowState,
  type PresetCreateFlowState,
} from '../../src/flows/preset-create-flow.js'

describe('preset create flow', () => {
  it("starts at step 'source' with empty defaults", () => {
    expect(createPresetCreateFlowState()).toEqual({
      step: 'source',
      env: {},
      allKeys: [],
      selectedKeys: [],
      presetName: '',
    })
  })

  describe('file path', () => {
    function goToFilePath(): PresetCreateFlowState {
      return advancePresetCreateFlow(createPresetCreateFlowState(), {
        type: 'select-source',
        source: 'file',
      })
    }

    it('source=file advances to filePath', () => {
      expect(goToFilePath().step).toBe('filePath')
    })

    it('set-file-path advances to keys', () => {
      const state = advancePresetCreateFlow(goToFilePath(), {
        type: 'set-file-path',
        filePath: '/path/to/env.json',
      })
      expect(state.step).toBe('keys')
      expect(state.filePath).toBe('/path/to/env.json')
    })

    it('set-error stays on filePath with error message', () => {
      const state = advancePresetCreateFlow(goToFilePath(), {
        type: 'set-error',
        error: 'File not found',
      })
      expect(state.step).toBe('filePath')
      expect(state.error).toBe('File not found')
    })
  })

  describe('manual input path', () => {
    function goToManualInput(): PresetCreateFlowState {
      return advancePresetCreateFlow(createPresetCreateFlowState(), {
        type: 'select-source',
        source: 'manual',
      })
    }

    it('source=manual advances to manualInput', () => {
      expect(goToManualInput().step).toBe('manualInput')
    })

    it('add-manual-pair accumulates pairs', () => {
      const state = advancePresetCreateFlow(goToManualInput(), {
        type: 'add-manual-pair',
        key: 'FOO',
        value: 'bar',
      })
      expect(state.env).toEqual({ FOO: 'bar' })
      expect(state.selectedKeys).toEqual(['FOO'])
      expect(state.step).toBe('manualInput')
    })

    it('add-manual-pair overwrites existing key', () => {
      const first = advancePresetCreateFlow(goToManualInput(), {
        type: 'add-manual-pair',
        key: 'FOO',
        value: 'bar',
      })
      const second = advancePresetCreateFlow(first, {
        type: 'add-manual-pair',
        key: 'FOO',
        value: 'updated',
      })
      expect(second.env.FOO).toBe('updated')
      expect(second.selectedKeys).toEqual(['FOO'])
    })

    it('set-error on manualInput sets error', () => {
      const state = advancePresetCreateFlow(goToManualInput(), {
        type: 'set-error',
        error: 'Invalid format',
      })
      expect(state.error).toBe('Invalid format')
    })

    it('finish-manual-input advances to name', () => {
      const state = advancePresetCreateFlow(goToManualInput(), {
        type: 'finish-manual-input',
      })
      expect(state.step).toBe('name')
    })
  })

  describe('shared path after source input', () => {
    function goToNameViaFile(): PresetCreateFlowState {
      const filePath = advancePresetCreateFlow(createPresetCreateFlowState(), {
        type: 'select-source',
        source: 'file',
      })
      const keys = advancePresetCreateFlow(filePath, {
        type: 'set-file-path',
        filePath: '/env.json',
      })
      return advancePresetCreateFlow(keys, {
        type: 'select-keys',
        keys: ['API_KEY'],
        env: { API_KEY: 'secret' },
      })
    }

    function goToNameViaManual(): PresetCreateFlowState {
      const manual = advancePresetCreateFlow(createPresetCreateFlowState(), {
        type: 'select-source',
        source: 'manual',
      })
      return advancePresetCreateFlow(manual, {
        type: 'finish-manual-input',
      })
    }

    it('set-name advances to destination', () => {
      const state = advancePresetCreateFlow(goToNameViaFile(), {
        type: 'set-name',
        name: 'my-preset',
      })
      expect(state.step).toBe('destination')
      expect(state.presetName).toBe('my-preset')
    })

    it('select-destination advances to confirm', () => {
      const name = advancePresetCreateFlow(goToNameViaFile(), {
        type: 'set-name',
        name: 'my-preset',
      })
      const dest = advancePresetCreateFlow(name, {
        type: 'select-destination',
        destination: 'global',
      })
      expect(dest.step).toBe('confirm')
      expect(dest.destination).toBe('global')
    })

    it('confirm advances to done', () => {
      const name = advancePresetCreateFlow(goToNameViaFile(), {
        type: 'set-name',
        name: 'my-preset',
      })
      const dest = advancePresetCreateFlow(name, {
        type: 'select-destination',
        destination: 'project',
      })
      const done = advancePresetCreateFlow(dest, { type: 'confirm' })
      expect(done.step).toBe('done')
    })

    it('manual path reaches done through name→destination→confirm', () => {
      const name = advancePresetCreateFlow(goToNameViaManual(), {
        type: 'set-name',
        name: 'manual-preset',
      })
      const dest = advancePresetCreateFlow(name, {
        type: 'select-destination',
        destination: 'global',
      })
      const done = advancePresetCreateFlow(dest, { type: 'confirm' })
      expect(done.step).toBe('done')
      expect(done.presetName).toBe('manual-preset')
    })
  })

  it('ignores invalid transitions without mutating state', () => {
    const state = createPresetCreateFlowState()

    expect(
      advancePresetCreateFlow(state, {
        type: 'select-keys',
        keys: ['FOO'],
        env: { FOO: 'bar' },
      }),
    ).toEqual(state)

    expect(
      advancePresetCreateFlow(state, {
        type: 'confirm',
      }),
    ).toEqual(state)
  })

  it('ignores changes after the flow is done', () => {
    const source = advancePresetCreateFlow(createPresetCreateFlowState(), {
      type: 'select-source',
      source: 'manual',
    })
    const name = advancePresetCreateFlow(source, {
      type: 'finish-manual-input',
    })
    const dest = advancePresetCreateFlow(name, {
      type: 'set-name',
      name: 'test',
    })
    const confirm = advancePresetCreateFlow(dest, {
      type: 'select-destination',
      destination: 'global',
    })
    const done = advancePresetCreateFlow(confirm, { type: 'confirm' })

    expect(
      advancePresetCreateFlow(done, {
        type: 'select-source',
        source: 'file',
      }),
    ).toEqual(done)
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run tests/flows/preset-create-flow.test.ts`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/flows/preset-create-flow.ts tests/flows/preset-create-flow.test.ts
git commit -m "refactor: rewrite preset-create-flow state machine for full interactive wizard"
```

---

### Task 2: Update readEnvFile to handle JSON env field

**Files:**
- Modify: `src/commands/preset/create.ts`

- [ ] **Step 1: Add tests for readEnvFile JSON env field extraction**

Create a new test section in `tests/commands/create.test.ts` (we'll rewrite the full file later, but add the readEnvFile tests now). Actually, since `readEnvFile` will become a shared utility used by the ink component via a callback, extract it first.

Instead, we'll keep `readEnvFile` in `create.ts` and add a test for the JSON env field logic. Add to `tests/commands/create.test.ts`:

Actually, let's keep `readEnvFile` and `parseInlinePairs` as exported functions from `create.ts` (they already are). We'll test them inline. Since we'll fully rewrite the command tests later, add just the new readEnvFile behavior test now.

For now, just update the `readEnvFile` function in `src/commands/preset/create.ts`. The current function at line 56-68:

```typescript
async function readEnvFile(filePath: string): Promise<EnvMap> {
  try {
    const content = await readFile(filePath, 'utf8')
    const extension = extname(filePath).toLowerCase()
    const parsed = extension === '.yaml' || extension === '.yml'
      ? parseYaml(content)
      : JSON.parse(content)

    return toProcessEnvMap((parsed ?? {}) as Record<string, unknown>)
  } catch {
    throw new CliError(`Failed to read env file: ${filePath}`, 2)
  }
}
```

Replace it with:

```typescript
export async function readEnvFile(filePath: string): Promise<{ allKeys: string[]; env: EnvMap }> {
  try {
    const content = await readFile(filePath, 'utf8')
    const extension = extname(filePath).toLowerCase()

    if (extension !== '.yaml' && extension !== '.yml' && extension !== '.json') {
      throw new CliError(`Unsupported file format: ${extension}`, 2)
    }

    const parsed = extension === '.yaml' || extension === '.yml'
      ? parseYaml(content)
      : JSON.parse(content)

    const raw = (parsed ?? {}) as Record<string, unknown>
    const source = extension === '.json'
      && raw
      && typeof raw === 'object'
      && 'env' in raw
      && raw.env
      && typeof raw.env === 'object'
      && !Array.isArray(raw.env)
      ? raw.env as Record<string, unknown>
      : raw

    const env = toProcessEnvMap(source)
    return {
      allKeys: Object.keys(env),
      env,
    }
  } catch (error) {
    if (error instanceof CliError) throw error
    throw new CliError(`Failed to read env file: ${filePath}`, 2)
  }
}
```

- [ ] **Step 2: Update readEnvFile in src/commands/preset/create.ts**

Replace the existing `readEnvFile` function (lines 56-68) with the new version above. Also remove the `buildPlaceholderEnv` function (lines 70-82) entirely.

- [ ] **Step 3: Run existing tests to see what breaks**

Run: `npx vitest run tests/commands/create.test.ts`
Expected: Some tests fail because `readEnvFile` now returns `{ allKeys, env }` instead of just `EnvMap`, and the command function signature has changed. This is expected — we fix the command and tests in later tasks.

- [ ] **Step 4: Commit**

```bash
git add src/commands/preset/create.ts
git commit -m "refactor: update readEnvFile to extract JSON env field and return allKeys"
```

---

### Task 3: Rewrite the ink component

**Files:**
- Rewrite: `src/ink/preset-create-app.tsx`

- [ ] **Step 1: Write the new PresetCreateApp component**

Replace the entire content of `src/ink/preset-create-app.tsx`:

```tsx
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

function SourceStep({
  cursor,
}: {
  cursor: number
}) {
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
            <Text color={i === cursor ? 'cyan' : undefined}>{opt.label}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function FilePathStep({
  value,
  error,
}: {
  value: string
  error?: string
}) {
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

function NameStep({
  value,
}: {
  value: string
}) {
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

function DestinationStep({
  cursor,
}: {
  cursor: number
}) {
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
            <Text color={i === cursor ? 'cyan' : undefined}>{opt.label}</Text>
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

    // source step
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

    // filePath step
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

    // keys step
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

    // manualInput step
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

    // name step
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
      if (key.return && textInput.trim().length === 0) {
        return
      }
      if (input && !key.ctrl && !key.meta) {
        setTextInput((v) => v + input)
        return
      }
    }

    // destination step
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

    // confirm step
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
            source: state.source,
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
        <FilePathStep value={textInput} error={state.error} />
      )}
      {state.step === 'keys' && (
        <KeysStep keys={allKeys} selectedKeys={state.selectedKeys} cursor={listCursor} />
      )}
      {state.step === 'manualInput' && (
        <ManualInputStep
          entries={state.selectedKeys.map((k) => [k, state.env[k] ?? ''] as [string, string])}
          value={textInput}
          error={state.error}
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
            fromFiles={state.filePath ? [state.filePath] : undefined}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/ink/preset-create-app.tsx
git commit -m "refactor: rewrite preset-create-app with full interactive wizard UI"
```

---

### Task 4: Rewrite the command function

**Files:**
- Rewrite: `src/commands/preset/create.ts`
- Rewrite: `tests/commands/create.test.ts`

- [ ] **Step 1: Rewrite the command function**

Replace the entire content of `src/commands/preset/create.ts`:

```typescript
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

import { parse as parseYaml } from 'yaml'

import { CliError } from '../../core/errors.js'
import { envMapSchema, type EnvMap } from '../../core/schema.js'
import { toProcessEnvMap } from '../../core/process-env.js'
import type { PresetCreateAppResult } from '../../ink/preset-create-app.js'

type PresetService = {
  write: (preset: {
    name: string
    createdAt: string
    updatedAt: string
    env: EnvMap
  }) => Promise<unknown>
}

type ProjectEnvService = {
  write: (env: EnvMap) => Promise<unknown>
}

export async function readEnvFile(filePath: string): Promise<{ allKeys: string[]; env: EnvMap }> {
  try {
    const content = await readFile(filePath, 'utf8')
    const extension = extname(filePath).toLowerCase()

    if (extension !== '.yaml' && extension !== '.yml' && extension !== '.json') {
      throw new CliError(`Unsupported file format: ${extension}`, 2)
    }

    const parsed = extension === '.yaml' || extension === '.yml'
      ? parseYaml(content)
      : JSON.parse(content)

    const raw = (parsed ?? {}) as Record<string, unknown>
    const source = extension === '.json'
      && raw
      && typeof raw === 'object'
      && 'env' in raw
      && raw.env
      && typeof raw.env === 'object'
      && !Array.isArray(raw.env)
      ? raw.env as Record<string, unknown>
      : raw

    const env = toProcessEnvMap(source)
    return {
      allKeys: Object.keys(env),
      env,
    }
  } catch (error) {
    if (error instanceof CliError) throw error
    throw new CliError(`Failed to read env file: ${filePath}`, 2)
  }
}

export function createPresetCreateCommand({
  presetService,
  projectEnvService,
  renderFlow,
}: {
  presetService: PresetService
  projectEnvService: ProjectEnvService
  renderFlow: () => Promise<PresetCreateAppResult | void>
}) {
  return async function createPreset(): Promise<void> {
    const result = await renderFlow()

    if (!result) return

    const selectedEnv: EnvMap = {}
    for (const key of result.selectedKeys) {
      selectedEnv[key] = result.env[key] ?? ''
    }

    const timestamp = new Date().toISOString()

    if (result.destination === 'project') {
      await projectEnvService.write(selectedEnv)
      return
    }

    await presetService.write({
      name: result.presetName,
      createdAt: timestamp,
      updatedAt: timestamp,
      env: selectedEnv,
    })
  }
}
```

- [ ] **Step 2: Rewrite the command tests**

Replace the entire content of `tests/commands/create.test.ts`:

```typescript
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi, afterEach } from 'vitest'

import { createPresetCreateCommand, readEnvFile } from '../../src/commands/preset/create.js'
import { CliError } from '../../src/core/errors.js'

const tempRoots: string[] = []

async function createTempRoot() {
  const root = await mkdtemp(join(tmpdir(), 'cc-env-create-'))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('readEnvFile', () => {
  it('reads a flat JSON file', async () => {
    const root = await createTempRoot()
    const file = join(root, 'env.json')
    await writeFile(file, JSON.stringify({ API_KEY: 'secret', PORT: '3000' }))

    const result = await readEnvFile(file)
    expect(result.allKeys).toEqual(['API_KEY', 'PORT'])
    expect(result.env).toEqual({ API_KEY: 'secret', PORT: '3000' })
  })

  it('extracts from nested env field in JSON', async () => {
    const root = await createTempRoot()
    const file = join(root, 'env.json')
    await writeFile(file, JSON.stringify({ env: { API_KEY: 'secret' }, other: true }))

    const result = await readEnvFile(file)
    expect(result.allKeys).toEqual(['API_KEY'])
    expect(result.env).toEqual({ API_KEY: 'secret' })
  })

  it('falls back to top-level when env is not an object', async () => {
    const root = await createTempRoot()
    const file = join(root, 'env.json')
    await writeFile(file, JSON.stringify({ env: 'not-an-object', API_KEY: 'secret' }))

    const result = await readEnvFile(file)
    expect(result.env).toEqual({ API_KEY: 'secret' })
  })

  it('reads a YAML file', async () => {
    const root = await createTempRoot()
    const file = join(root, 'env.yaml')
    await writeFile(file, 'API_KEY: secret\nPORT: "3000"\n')

    const result = await readEnvFile(file)
    expect(result.allKeys).toEqual(['API_KEY', 'PORT'])
    expect(result.env).toEqual({ API_KEY: 'secret', PORT: '3000' })
  })

  it('throws for unsupported file extensions', async () => {
    const root = await createTempRoot()
    const file = join(root, 'env.toml')
    await writeFile(file, 'content')

    await expect(readEnvFile(file)).rejects.toThrowError(
      new CliError('Unsupported file format: .toml', 2),
    )
  })

  it('throws CliError for unreadable files', async () => {
    await expect(readEnvFile('/nonexistent/file.json')).rejects.toThrowError(
      expect.any(CliError),
    )
  })

  it('throws CliError for invalid JSON content', async () => {
    const root = await createTempRoot()
    const file = join(root, 'env.json')
    await writeFile(file, '{invalid')

    await expect(readEnvFile(file)).rejects.toThrowError(
      expect.any(CliError),
    )
  })
})

describe('createPresetCreateCommand', () => {
  it('writes to presetService when destination is global', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn().mockResolvedValue({
      source: 'manual',
      env: { API_KEY: 'secret' },
      selectedKeys: ['API_KEY'],
      presetName: 'my-preset',
      destination: 'global',
    })

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow,
    })

    await createPreset()

    expect(presetService.write).toHaveBeenCalledWith({
      name: 'my-preset',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      env: { API_KEY: 'secret' },
    })
    expect(projectEnvService.write).not.toHaveBeenCalled()
  })

  it('writes to projectEnvService when destination is project', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn().mockResolvedValue({
      source: 'file',
      filePath: '/path/to/env.json',
      env: { API_KEY: 'secret', OTHER: 'value' },
      selectedKeys: ['API_KEY'],
      presetName: 'proj',
      destination: 'project',
    })

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow,
    })

    await createPreset()

    expect(projectEnvService.write).toHaveBeenCalledWith({ API_KEY: 'secret' })
    expect(presetService.write).not.toHaveBeenCalled()
  })

  it('does nothing when renderFlow returns undefined', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn().mockResolvedValue(undefined)

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow,
    })

    await createPreset()

    expect(presetService.write).not.toHaveBeenCalled()
    expect(projectEnvService.write).not.toHaveBeenCalled()
  })

  it('only includes selected keys in the written env', async () => {
    const presetService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const projectEnvService = {
      write: vi.fn().mockResolvedValue(undefined),
    }
    const renderFlow = vi.fn().mockResolvedValue({
      source: 'file',
      filePath: '/env.json',
      env: { A: '1', B: '2', C: '3' },
      selectedKeys: ['A', 'C'],
      presetName: 'partial',
      destination: 'global',
    })

    const createPreset = createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow,
    })

    await createPreset()

    expect(presetService.write).toHaveBeenCalledWith({
      name: 'partial',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      env: { A: '1', C: '3' },
    })
  })
})
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run tests/commands/create.test.ts`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/commands/preset/create.ts tests/commands/create.test.ts
git commit -m "refactor: simplify preset create command to thin renderFlow wrapper"
```

---

### Task 5: Update CLI registration

**Files:**
- Modify: `src/cli.ts:235-266`

- [ ] **Step 1: Update the preset create command registration in cli.ts**

Find the current block (lines 235-266):

```typescript
presetCommand.command('create [pairs...]')
  .option('-n, --name <name>')
  .option('-f, --file <path>')
  .option('--project')
  .action((pairs, options) =>
    createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow: async (context) => {
        let result: React.ComponentProps<typeof PresetCreateApp>['onSubmit'] extends (
          result: infer TResult,
        ) => unknown
          ? TResult | undefined
          : undefined
        const app = render(
          h(PresetCreateApp, {
            onSubmit: (value) => {
              result = value
            },
          }),
        )

        await app.waitUntilExit()
        return result
      },
    })({
      name: options.name,
      file: options.file,
      pairs,
      project: options.project,
    }),
  )
```

Replace with:

```typescript
presetCommand.command('create')
  .action(() =>
    createPresetCreateCommand({
      presetService,
      projectEnvService,
      renderFlow: async () => {
        let result: React.ComponentProps<typeof PresetCreateApp>['onSubmit'] extends (
          result: infer TResult,
        ) => unknown
          ? TResult | undefined
          : undefined
        const app = render(
          h(PresetCreateApp, {
            onSubmit: (value) => {
              result = value
            },
            readFile: async (filePath) => {
              const { readEnvFile } = await import('./commands/preset/create.js')
              return readEnvFile(filePath)
            },
            globalPresetPath: (name) => presetService.getPath(name),
            projectEnvPath: join(cwd, '.cc-env', 'env.json'),
          }),
        )

        await app.waitUntilExit()
        return result
      },
    })(),
  )
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/cli.ts
git commit -m "refactor: remove preset create CLI flags, wire up full interactive flow"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 2: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit if any fixups were needed**
