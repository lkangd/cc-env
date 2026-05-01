import { access, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { getCliName } from '../core/cli-name.js'
import { findClaudeExecutable } from '../core/find-claude.js'
import { resolveGlobalRoot } from '../core/paths.js'

type CheckResult = { label: string; ok: boolean; detail?: string }

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function checkGlobalRoot(globalRoot: string): Promise<CheckResult> {
  const ok = await exists(globalRoot)
  return { label: 'Global root (~/.cc-env)', ok, detail: globalRoot }
}

async function checkPresetsDir(globalRoot: string): Promise<CheckResult> {
  const dir = join(globalRoot, 'presets')
  const ok = await exists(dir)
  if (!ok) return { label: 'Presets directory', ok: false, detail: dir }
  const entries = await readdir(dir).catch(() => [] as string[])
  const count = entries.filter((e) => e.endsWith('.json')).length
  return { label: 'Presets directory', ok: true, detail: `${dir} (${count} preset${count === 1 ? '' : 's'})` }
}

async function checkClaudeExecutable(): Promise<CheckResult> {
  try {
    const path = findClaudeExecutable()
    return { label: 'Claude executable', ok: true, detail: path }
  } catch {
    return { label: 'Claude executable', ok: false, detail: 'not found — run: npm install -g @anthropic-ai/claude-code' }
  }
}

async function checkProjectEnv(cwd: string): Promise<CheckResult> {
  const path = join(cwd, '.cc-env', 'env.json')
  const ok = await exists(path)
  return { label: 'Project env (.cc-env/env.json)', ok, detail: ok ? path : `not initialized — run: ${getCliName()} init` }
}

function renderCheck(result: CheckResult, json: boolean): string {
  if (json) return ''
  const icon = result.ok ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✘\x1b[0m'
  const detail = result.detail ? `\x1b[2m  ${result.detail}\x1b[0m` : ''
  return `  ${icon}  ${result.label}${detail ? '\n' + detail : ''}`
}

export async function runDoctorCommand({
  cwd,
  json = false,
  stdout = process.stdout,
}: {
  cwd: string
  json?: boolean
  stdout?: Pick<NodeJS.WriteStream, 'write'>
}): Promise<void> {
  const globalRoot = resolveGlobalRoot()

  const checks = await Promise.all([
    checkGlobalRoot(globalRoot),
    checkPresetsDir(globalRoot),
    checkClaudeExecutable(),
    checkProjectEnv(cwd),
  ])

  if (json) {
    stdout.write(JSON.stringify(checks, null, 2) + '\n')
    return
  }

  stdout.write('\n')
  for (const check of checks) {
    stdout.write(renderCheck(check, false) + '\n')
  }
  stdout.write('\n')

  const failed = checks.filter((c) => !c.ok)
  if (failed.length === 0) {
    stdout.write('  \x1b[32mAll checks passed.\x1b[0m\n\n')
  } else {
    stdout.write(`  \x1b[33m${failed.length} check${failed.length > 1 ? 's' : ''} failed.\x1b[0m\n\n`)
    process.exitCode = 1
  }
}
