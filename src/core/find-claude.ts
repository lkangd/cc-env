import { execSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'

import { CliError } from './errors.js'

function resolveToJsFile(filePath: string): string {
  try {
    const realPath = realpathSync(filePath)
    if (realPath.endsWith('.js')) return realPath
    if (existsSync(realPath)) {
      const content = readFileSync(realPath, 'utf-8')
      if (
        content.startsWith('#!/usr/bin/env node') ||
        /^#!.*\/node$/m.test(content) ||
        content.includes('require(') ||
        content.includes('import ')
      ) {
        return realPath
      }
    }

    for (const candidate of [
      realPath + '.js',
      realPath.replace(/\/bin\//, '/lib/') + '.js',
      realPath.replace(/\/\.bin\//, '/lib/bin/') + '.js',
    ]) {
      if (existsSync(candidate)) return candidate
    }

    return realPath
  } catch {
    return filePath
  }
}

export function findClaudeExecutable(): string {
  try {
    let claudePath = execSync('which claude', { encoding: 'utf-8' }).trim()
    const aliasMatch = claudePath.match(/:\s*aliased to\s+(.+)$/)
    if (aliasMatch?.[1]) claudePath = aliasMatch[1]

    if (existsSync(claudePath)) {
      const content = readFileSync(claudePath, 'utf-8')
      if (content.startsWith('#!/bin/bash')) {
        const execMatch = content.match(/exec\s+"([^"]+)"/)
        if (execMatch?.[1]) return resolveToJsFile(execMatch[1])
      }
    }

    return resolveToJsFile(claudePath)
  } catch {}

  const home = process.env.HOME ?? process.cwd()
  const localWrapper = join(home, '.claude', 'local', 'claude')
  if (existsSync(localWrapper)) {
    const content = readFileSync(localWrapper, 'utf-8')
    if (content.startsWith('#!/bin/bash')) {
      const execMatch = content.match(/exec\s+"([^"]+)"/)
      if (execMatch?.[1]) return resolveToJsFile(execMatch[1])
    }
  }

  const localBin = join(home, '.claude', 'local', 'node_modules', '.bin', 'claude')
  if (existsSync(localBin)) return resolveToJsFile(localBin)

  throw new CliError(
    'Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code',
  )
}
