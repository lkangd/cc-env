const COMMANDS = ['run', 'init', 'restore', 'show', 'delete', 'create', 'doctor', 'completion', '--help', '--version']

export function generateCompletion(shell: string, cliName: 'cc-env' | 'ccenv' = 'cc-env'): string {
  switch (shell) {
    case 'zsh':
      return generateZsh(cliName)
    case 'fish':
      return generateFish(cliName)
    default:
      return generateBash(cliName)
  }
}

function generateBash(cliName: 'cc-env' | 'ccenv'): string {
  return `# ${cliName} bash completion
# Add to ~/.bashrc: eval "$(cc-env completion --shell bash)"
_cc_env_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local commands="${COMMANDS.join(' ')}"
  COMPREPLY=($(compgen -W "$commands" -- "$cur"))
}
complete -F _cc_env_completions cc-env
complete -F _cc_env_completions ccenv
`
}

function generateZsh(cliName: 'cc-env' | 'ccenv'): string {
  const cmds = COMMANDS.filter((c) => !c.startsWith('-'))
  const cmdList = cmds.map((c) => `    '${c}'`).join('\n')
  return `# ${cliName} zsh completion
# Add to ~/.zshrc: eval "$(cc-env completion --shell zsh)"
_cc_env() {
  local -a commands
  commands=(
${cmdList}
  )
  _describe 'command' commands
}
compdef _cc_env cc-env
compdef _cc_env ccenv
`
}

function generateFish(cliName: 'cc-env' | 'ccenv'): string {
  const cmds = [
    ['run', 'Run claude with merged environment variables'],
    ['init', 'Initialize cc-env for the current project'],
    ['restore', 'Restore environment variables from a previous snapshot'],
    ['show', 'List and view all presets'],
    ['delete', 'Delete a saved preset'],
    ['create', 'Create a new environment preset'],
    ['doctor', 'Check system health and configuration'],
    ['completion', 'Generate shell completion script'],
  ]
  const names = ['cc-env', 'ccenv'] as const
  const subcommandLines = names.flatMap(name =>
    cmds.map(([cmd, desc]) => `complete -c ${name} -f -n '__fish_use_subcommand' -a '${cmd}' -d '${desc}'`)
  )
  const flagLines = names.flatMap(name => [
    `complete -c ${name} -l help -d 'Show help'`,
    `complete -c ${name} -l version -d 'Show version'`,
    `complete -c ${name} -l json -d 'Output as JSON'`,
    `complete -c ${name} -l quiet -d 'Suppress non-essential output'`,
    `complete -c ${name} -l verbose -d 'Enable verbose output'`,
    `complete -c ${name} -l no-interactive -d 'Disable interactive prompts'`,
  ])
  return `# ${cliName} fish completion
# Add to fish config: cc-env completion --shell fish | source
${subcommandLines.join('\n')}
${flagLines.join('\n')}
`
}
