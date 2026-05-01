import { basename } from 'node:path'

const ALIASES = new Set(['cc-env', 'ccenv'])

export function getCliName(): 'cc-env' | 'ccenv' {
  const name = basename(process.argv[1] ?? '')
  if (ALIASES.has(name)) return name as 'cc-env' | 'ccenv'
  return 'cc-env'
}
