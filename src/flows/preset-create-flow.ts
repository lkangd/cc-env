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
  error?: string | undefined
}

export type PresetCreateFlowResult = Pick<
  PresetCreateFlowState,
  'source' | 'env' | 'selectedKeys' | 'presetName' | 'destination'
> & {
  filePath?: string | undefined
}

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
        const hasKey = state.selectedKeys.includes(action.key)
        return {
          ...state,
          env: { ...state.env, [action.key]: action.value },
          selectedKeys: hasKey ? state.selectedKeys : [...state.selectedKeys, action.key],
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
