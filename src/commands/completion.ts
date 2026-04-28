const COMMANDS = ['run', 'init', 'restore', 'show', 'delete', 'create', 'doctor', 'completion', '--help', '--version']

export function generateCompletion(shell: string): string {
  switch (shell) {
    case 'zsh':
      return generateZsh()
    case 'fish':
      return generateFish()
    default:
      return generateBash()
  }
}

function generateBash(): string {
  return `# cc-env bash completion
# Add to ~/.bashrc: eval "$(cc-env completion --shell bash)"
_cc_env_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local commands="${COMMANDS.join(' ')}"
  COMPREPLY=($(compgen -W "$commands" -- "$cur"))
}
complete -F _cc_env_completions cc-env
`
}

function generateZsh(): string {
  const cmds = COMMANDS.filter((c) => !c.startsWith('-'))
  const cmdList = cmds.map((c) => `    '${c}'`).join('\n')
  return `# cc-env zsh completion
# Add to ~/.zshrc: eval "$(cc-env completion --shell zsh)"
_cc_env() {
  local -a commands
  commands=(
${cmdList}
  )
  _describe 'command' commands
}
compdef _cc_env cc-env
`
}

function generateFish(): string {
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
  const lines = cmds.map(([cmd, desc]) => `complete -c cc-env -f -n '__fish_use_subcommand' -a '${cmd}' -d '${desc}'`)
  return `# cc-env fish completion
# Add to fish config: cc-env completion --shell fish | source
${lines.join('\n')}
complete -c cc-env -l help -d 'Show help'
complete -c cc-env -l version -d 'Show version'
complete -c cc-env -l json -d 'Output as JSON'
complete -c cc-env -l quiet -d 'Suppress non-essential output'
complete -c cc-env -l verbose -d 'Enable verbose output'
complete -c cc-env -l no-interactive -d 'Disable interactive prompts'
`
}
