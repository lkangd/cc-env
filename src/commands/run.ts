import { formatRunEnvBlock } from '../core/format.js'
import type { EnvMap } from '../core/schema.js'

import { requiredClaudeKeys } from '../core/claude-required-keys.js'

const detectTriggerKeys = ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'] as const

type PresetSelectItem = {
  name: string
  env: EnvMap
  source: 'global' | 'project'
}

type ClaudeSettingsEnvService = {
  read: () => Promise<Array<{ path: string; exists: boolean; env: EnvMap }>>
}

type PresetService = {
  listNames: () => Promise<string[]>
  read: (name: string) => Promise<{ env: EnvMap }>
}

type ProjectEnvService = {
  readWithMeta: () => Promise<{ env: EnvMap; name?: string | undefined }>
}

type ProjectStateService = {
  getLastPreset: (cwd: string) => Promise<{ presetName: string; source: 'global' | 'project' } | undefined>
  saveLastPreset: (cwd: string, ref: { presetName: string; source: 'global' | 'project' }) => Promise<void>
}

type FindClaude = () => string

type RenderPresetSelect = (input: {
  presets: Array<PresetSelectItem>
  defaultIndex: number
}) => Promise<PresetSelectItem | undefined>

type RunCommandResult =
  | { status: 'executed' }
  | {
      status: 'needs-preset'
      detectedEnv: EnvMap
      requiredKeys: string[]
    }

function getDetectedEnv(sources: Array<{ env: EnvMap }>): EnvMap {
  return sources.reduce<EnvMap>((acc, source) => ({ ...acc, ...source.env }), {} as EnvMap)
}

export function createRunCommand({
  claudeSettingsEnvService,
  presetService,
  projectEnvService,
  projectStateService,
  findClaude,
  renderPresetSelect,
  spawnCommand,
  stdout = process.stdout
}: {
  claudeSettingsEnvService: ClaudeSettingsEnvService
  presetService: PresetService
  projectEnvService: ProjectEnvService
  projectStateService: ProjectStateService
  findClaude: FindClaude
  renderPresetSelect: RenderPresetSelect
  spawnCommand: (command: string, args: string[], env: NodeJS.ProcessEnv) => Promise<void>
  stdout?: Pick<NodeJS.WriteStream, 'write'>
}) {
  return async function run({
    args = [],
    dryRun = false,
    yes = false,
    json = false,
    skipDetect = false,
    cwd
  }: {
    args?: string[]
    dryRun?: boolean
    yes?: boolean
    json?: boolean
    skipDetect?: boolean
    cwd: string
  }): Promise<RunCommandResult | void> {
    const sources = await claudeSettingsEnvService.read()
    const detectedEnv = getDetectedEnv(sources)
    const requiredKeys = requiredClaudeKeys.filter((key) => key in detectedEnv)
    const hasDetectTrigger = detectTriggerKeys.some((key) => key in detectedEnv)

    if (!skipDetect && hasDetectTrigger) {
      return {
        status: 'needs-preset',
        detectedEnv,
        requiredKeys,
      }
    }

    // Step 1: Collect all presets (project + global)
    const names = await presetService.listNames()
    const globalPresets = await Promise.all(
      names.map(name => presetService.read(name).then(p => ({ name, env: p.env, source: 'global' as const })))
    )
    const { env: projectEnv, name: projectName } = await projectEnvService.readWithMeta()
    const projectPreset =
      Object.keys(projectEnv).length > 0
        ? [{ name: projectName ?? 'project', env: projectEnv, source: 'project' as const }]
        : []

    const presets = [...projectPreset, ...globalPresets]
    if (presets.length === 0) {
      return {
        status: 'needs-preset',
        detectedEnv,
        requiredKeys,
      }
    }

    // Step 2: Determine default selection
    const savedRef = await projectStateService.getLastPreset(cwd)
    let defaultIndex = 0
    if (savedRef) {
      const idx = presets.findIndex(p => p.name === savedRef.presetName && p.source === savedRef.source)
      if (idx >= 0) defaultIndex = idx
    } else if (projectPreset.length > 0) {
      defaultIndex = 0
    }

    // Step 3: Select preset (interactive or auto)
    let selected: PresetSelectItem | undefined
    if (yes) {
      selected = presets[defaultIndex]
    } else {
      selected = await renderPresetSelect({ presets, defaultIndex })
    }
    if (!selected) return

    // Step 4: Save selection
    await projectStateService.saveLastPreset(cwd, {
      presetName: selected.name,
      source: selected.source
    })

    // Step 5: Resolve claude command
    let command: string
    let claudeArgs: string[]
    if (args.length > 0 && args[0] === 'claude') {
      command = 'claude'
      claudeArgs = args.slice(1)
    } else {
      command = findClaude()
      claudeArgs = args
    }

    // Step 6: Print env vars
    if (json && dryRun) {
      stdout.write(
        JSON.stringify(
          {
            preset: { name: selected.name, source: selected.source },
            command: [command, ...claudeArgs],
            env: selected.env
          },
          null,
          2
        ) + '\n'
      )
      return { status: 'executed' }
    }

    const presetKeys = new Set(Object.keys(selected.env))
    const envBlock = formatRunEnvBlock(selected.env, presetKeys)
    stdout.write(`Using preset: ${selected.name} (${selected.source})\n${envBlock}\n\n`)

    if (dryRun) {
      const preview = [command, ...claudeArgs].join(' ')
      stdout.write(`Would run: ${preview}\n`)
      return { status: 'executed' }
    }

    // Step 7: Spawn
    await spawnCommand(command, claudeArgs, { ...process.env, ...selected.env })
    return { status: 'executed' }
  }
}
