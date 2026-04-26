import { CliError } from '../core/errors.js'
import { formatEnvBlock } from '../core/format.js'
import type { EnvMap } from '../core/schema.js'

const requiredInitKeys = [
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_REASONING_MODEL',
] as const

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

type RuntimeEnvService = {
  merge: (input: {
    processEnv: EnvMap
    settingsEnv: EnvMap
    projectEnv: EnvMap
    presetEnv: EnvMap
  }) => EnvMap
}

type EnvSources = (input: { presetEnv: EnvMap }) => Promise<{
  processEnv: EnvMap
  settingsEnv: EnvMap
  projectEnv: EnvMap
  presetEnv: EnvMap
}>

type FindClaude = () => string

type RenderPresetSelect = (input: {
  presets: Array<PresetSelectItem>
  defaultIndex: number
}) => Promise<PresetSelectItem | undefined>

export function createRunCommand({
  claudeSettingsEnvService,
  presetService,
  projectEnvService,
  projectStateService,
  runtimeEnvService,
  envSources,
  findClaude,
  renderPresetSelect,
  spawnCommand,
  stdout = process.stdout,
}: {
  claudeSettingsEnvService: ClaudeSettingsEnvService
  presetService: PresetService
  projectEnvService: ProjectEnvService
  projectStateService: ProjectStateService
  runtimeEnvService: RuntimeEnvService
  envSources: EnvSources
  findClaude: FindClaude
  renderPresetSelect: RenderPresetSelect
  spawnCommand: (command: string, args: string[], env: NodeJS.ProcessEnv) => Promise<void>
  stdout?: Pick<NodeJS.WriteStream, 'write'>
}) {
  return async function run({
    args = [],
    dryRun = false,
    yes = false,
    cwd,
  }: {
    args?: string[]
    dryRun?: boolean
    yes?: boolean
    cwd: string
  }): Promise<void> {
    // Step 0: Check settings files for init-managed keys
    const sources = await claudeSettingsEnvService.read()
    const mergedSettingsEnv = sources.reduce<EnvMap>(
      (acc, s) => ({ ...acc, ...s.env }),
      {} as EnvMap,
    )
    const staleKeys = requiredInitKeys.filter((k) => k in mergedSettingsEnv)
    if (staleKeys.length > 0) {
      throw new CliError(
        `Found init-managed keys in Claude settings: ${staleKeys.join(', ')}. Run "cc-env init" first.`,
      )
    }

    // Step 1: Collect all presets (project + global)
    const names = await presetService.listNames()
    const globalPresets = await Promise.all(
      names.map((name) =>
        presetService.read(name).then((p) => ({ name, env: p.env, source: 'global' as const })),
      ),
    )
    const { env: projectEnv, name: projectName } = await projectEnvService.readWithMeta()
    const projectPreset =
      Object.keys(projectEnv).length > 0
        ? [{ name: projectName ?? 'project', env: projectEnv, source: 'project' as const }]
        : []

    const presets = [...projectPreset, ...globalPresets]
    if (presets.length === 0) {
      throw new CliError('No presets found. Create one with "cc-env preset create".')
    }

    // Step 2: Determine default selection
    const savedRef = await projectStateService.getLastPreset(cwd)
    let defaultIndex = 0
    if (savedRef) {
      const idx = presets.findIndex(
        (p) => p.name === savedRef.presetName && p.source === savedRef.source,
      )
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
      source: selected.source,
    })

    // Step 5: Merge env
    const mergedEnv = runtimeEnvService.merge(await envSources({ presetEnv: selected.env }))

    // Step 6: Resolve claude command
    let command: string
    let claudeArgs: string[]
    if (args.length > 0 && args[0] === 'claude') {
      command = 'claude'
      claudeArgs = args.slice(1)
    } else {
      command = findClaude()
      claudeArgs = args
    }

    // Step 7: Print env vars
    const envBlock = formatEnvBlock(mergedEnv)
    stdout.write(`Using preset: ${selected.name} (${selected.source})\n${envBlock}\n\n`)

    if (dryRun) {
      const preview = [command, ...claudeArgs].join(' ')
      stdout.write(`Would run: ${preview}\n`)
      return
    }

    // Step 8: Spawn
    await spawnCommand(command, claudeArgs, { ...process.env, ...mergedEnv })
  }
}
