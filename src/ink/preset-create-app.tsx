import React, { useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'

import {
  advancePresetCreateFlow,
  createPresetCreateFlowState,
  type PresetCreateDestination,
  type PresetCreateFlowResult,
} from '../flows/preset-create-flow.js'

export type PresetCreateAppResult = PresetCreateFlowResult & {
  destination: PresetCreateDestination
}

export function PresetCreateApp({
  onSubmit,
}: {
  onSubmit: (result: PresetCreateAppResult) => Promise<void> | void
}) {
  const { exit } = useApp()
  const [state, setState] = useState(createPresetCreateFlowState)

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      exit()
      return
    }

    if (state.step === 'source' && (input === 'p' || key.return)) {
      setState((current) =>
        advancePresetCreateFlow(current, {
          type: 'select-source',
          source: 'process',
        }),
      )
      return
    }

    if (state.step === 'keys' && key.return) {
      setState((current) =>
        advancePresetCreateFlow(current, {
          type: 'select-keys',
          keys: ['ANTHROPIC_BASE_URL'],
        }),
      )
      return
    }

    if (state.step === 'destination') {
      const destination = input === 'p' ? 'project' : input === 's' || key.return ? 'preset' : undefined

      if (!destination) {
        return
      }

      setState((current) =>
        advancePresetCreateFlow(current, {
          type: 'select-destination',
          destination,
        }),
      )
      return
    }

    if (state.step === 'confirm' && key.return && state.destination) {
      const doneState = advancePresetCreateFlow(state, { type: 'confirm' })
      setState(doneState)
      void Promise.resolve(
        onSubmit({
          destination: state.destination,
          selectedSources: state.selectedSources,
          selectedKeys: state.selectedKeys,
        }),
      ).finally(() => {
        exit()
      })
    }
  })

  return (
    <Box flexDirection="column">
      <Text>Preset create</Text>
      {state.step === 'source' ? (
        <Text>Select source: press p for process</Text>
      ) : null}
      {state.step === 'keys' ? (
        <Text>Select keys: press enter to keep ANTHROPIC_BASE_URL</Text>
      ) : null}
      {state.step === 'destination' ? (
        <Text>Select destination: press p for project or s for preset</Text>
      ) : null}
      {state.step === 'confirm' ? (
        <Text>Press enter to confirm {state.destination}</Text>
      ) : null}
      {state.step === 'done' ? (
        <Text>Done</Text>
      ) : null}
    </Box>
  )
}
