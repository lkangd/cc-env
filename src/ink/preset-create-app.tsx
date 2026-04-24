import React, { useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'

import {
  advancePresetCreateFlow,
  createPresetCreateFlowState,
  type PresetCreateDestination,
} from '../flows/preset-create-flow.js'

type PresetCreateAppResult = {
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

    if (state.step === 'source' && (input === 'o' || key.return)) {
      setState((current) =>
        advancePresetCreateFlow(current, {
          type: 'select-source',
          source: 'openai',
        }),
      )
      return
    }

    if (state.step === 'keys') {
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
      void Promise.resolve(onSubmit({ destination: state.destination })).finally(() => {
        exit()
      })
    }
  })

  return (
    <Box flexDirection="column">
      <Text>Preset create</Text>
      {state.step === 'source' ? (
        <Text>Select source: press o for openai</Text>
      ) : null}
      {state.step === 'keys' ? (
        <Text>Select destination: press p for project or s for preset</Text>
      ) : null}
      {state.step === 'confirm' ? (
        <Text>Press enter to confirm {state.destination}</Text>
      ) : null}
    </Box>
  )
}
