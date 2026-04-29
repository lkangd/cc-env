import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

import { parse as parseYaml } from 'yaml'

import { requiredClaudeKeys } from '../../core/claude-required-keys.js'
import { CliError } from '../../core/errors.js'
import { ensureGitignoreEntry } from '../../core/gitignore.js'
import { envMapSchema, type EnvMap, type HistoryRecord, type SourceEntry } from '../../core/schema.js'
import { toProcessEnvMap } from '../../core/process-env.js'
import type { PresetCreateAppResult } from '../../ink/preset-create-app.js'

type ClaudeSettingsSource = {
  path: string
  exists: boolean
  env: EnvMap
}

type ClaudeSettingsEnvService = {
  read: () => Promise<ClaudeSettingsSource[]>
  write: (sources: Array<{ path: string; env: EnvMap }>) => Promise<void>
}

type HistoryService = {
  write: (record: Extract<HistoryRecord, { action: 'preset-create' }>) => Promise<unknown>
}

type PresetService = {
  write: (preset: {
    name: string
    createdAt: string
    updatedAt: string
    env: EnvMap
  }) => Promise<unknown>
}

type ProjectEnvService = {
  write: (env: EnvMap, meta?: { name?: string; createdAt?: string; updatedAt?: string }) => Promise<unknown>
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

function getDetectedEnv(sources: Array<{ env: EnvMap }>): EnvMap {
  return toProcessEnvMap(
    sources.reduce<EnvMap>((acc, source) => ({ ...acc, ...source.env }), {} as EnvMap),
  )
}

function omitKeys(env: EnvMap, keys: string[]): EnvMap {
  return envMapSchema.parse(
    Object.fromEntries(Object.entries(env).filter(([key]) => !keys.includes(key))),
  )
}

function buildSourceBackups(
  sources: ClaudeSettingsSource[],
  selectedKeys: string[],
  selectedEnv: EnvMap,
): SourceEntry[] {
  const backups = new Map<string, EnvMap>()

  for (const source of sources) {
    backups.set(source.path, envMapSchema.parse({}))
  }

  for (const key of selectedKeys) {
    for (const source of [...sources].reverse()) {
      if (!(key in source.env)) {
        continue
      }

      if (source.env[key] !== selectedEnv[key]) {
        continue
      }

      const current = backups.get(source.path) ?? envMapSchema.parse({})
      backups.set(
        source.path,
        envMapSchema.parse({
          ...current,
          [key]: source.env[key],
        }),
      )
      break
    }
  }

  return sources.map((source) => ({
    file: source.path,
    backup: backups.get(source.path) ?? envMapSchema.parse({}),
  }))
}

export function createPresetCreateCommand({
  presetService,
  projectEnvService,
  claudeSettingsEnvService,
  historyService,
  renderFlow,
  ensureGitignore = (dir, entry) => ensureGitignoreEntry(dir, entry),
}: {
  presetService: PresetService
  projectEnvService: ProjectEnvService
  claudeSettingsEnvService?: ClaudeSettingsEnvService
  historyService?: HistoryService
  renderFlow: (input: { detectedEnv: EnvMap; requiredKeys: string[] }) => Promise<PresetCreateAppResult | void>
  ensureGitignore?: (dir: string, entry: string) => Promise<void>
}) {
  return async function createPreset({ cwd }: { cwd: string }): Promise<{
    presetName: string
    source: 'global' | 'project'
  } | void> {
    const sources = claudeSettingsEnvService ? await claudeSettingsEnvService.read() : []
    const detectedEnv = claudeSettingsEnvService ? getDetectedEnv(sources) : {}
    const requiredKeys = requiredClaudeKeys.filter((key) => key in detectedEnv)
    const result = await renderFlow({ detectedEnv, requiredKeys })

    if (!result) return

    const selectedEnv: EnvMap = {}
    for (const key of result.selectedKeys) {
      selectedEnv[key] = result.env[key] ?? ''
    }

    const timestamp = new Date().toISOString()
    const selectedKeys = result.selectedKeys
    const sourceBackups = result.source === 'detected'
      ? buildSourceBackups(sources, selectedKeys, selectedEnv)
      : []

    if (result.destination === 'project') {
      await projectEnvService.write(selectedEnv, { name: result.presetName, createdAt: timestamp, updatedAt: timestamp })
      await ensureGitignore(cwd, '.cc-env')
    } else {
      await presetService.write({
        name: result.presetName,
        createdAt: timestamp,
        updatedAt: timestamp,
        env: selectedEnv,
      })
    }

    if (result.source === 'detected' && claudeSettingsEnvService && historyService) {
      await historyService.write({
        timestamp,
        action: 'preset-create',
        projectPath: cwd,
        presetName: result.presetName,
        destination: result.destination,
        migratedKeys: selectedKeys,
        sources: sourceBackups,
      })

      await claudeSettingsEnvService.write(
        sources.map((source) => ({
          path: source.path,
          env: omitKeys(
            source.env,
            Object.keys(sourceBackups.find((entry) => entry.file === source.path)?.backup ?? {}),
          ),
        })),
      )
    }

    return {
      presetName: result.presetName,
      source: result.destination,
    }
  }
}
