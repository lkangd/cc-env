<p align="center">
  <img src="./statics/logo.png" alt="cc-env" width="320" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@lkangd/cc-env"><img src="https://img.shields.io/npm/v/@lkangd/cc-env.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@lkangd/cc-env"><img src="https://img.shields.io/npm/dm/@lkangd/cc-env.svg" alt="npm downloads" /></a>
  <a href="https://github.com/lkangd/cc-env/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@lkangd/cc-env.svg" alt="license" /></a>
</p>

<p align="center">Manage runtime environment variables for <a href="https://claude.ai/code">Claude Code</a></p>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh.md">简体中文</a>
</p>

---

## Overview

`cc-env` is a CLI tool that lets you define, switch, and restore environment variable configurations for Claude Code — per project or via reusable presets. No more manually editing `settings.json` or juggling `.env` files across workspaces.

> **Alias:** `ccenv` can be used as a shorthand for `cc-env` everywhere (e.g., `ccenv run`, `ccenv create`).

## Installation

### via npm

```bash
npm install -g @lkangd/cc-env
```

Requires Node.js `>=20.19.2`.

### via Homebrew

```bash
brew tap lkangd/tap
brew install cc-env
```

## Quick Start

```bash
# 1. Initialize cc-env in your project
cc-env init

# 2. Create a preset with your environment variables
cc-env create

# 3. Run Claude Code with the preset applied
cc-env run
```

## Commands

| Command | Description |
|---|---|
| `cc-env init` | Initialize cc-env for the current project |
| `cc-env run [args...]` | Run Claude Code with merged environment variables |
| `cc-env restore` | Restore environment variables from a previous snapshot |
| `cc-env show` | List and view all saved presets |
| `cc-env create` | Create a new environment preset |
| `cc-env edit <name>` | Edit an existing preset |
| `cc-env rename <from> <to>` | Rename a preset |
| `cc-env delete` | Delete a saved preset |
| `cc-env doctor` | Check system health and configuration |
| `cc-env completion` | Generate shell completion script |

## Global Options

```
--verbose        Enable verbose output
--quiet          Suppress non-essential output
--no-interactive Disable interactive prompts (equivalent to -y)
```

## Shell Completion

> Both `cc-env` and `ccenv` are supported in completion scripts.

```bash
# bash
cc-env completion bash >> ~/.bashrc

# zsh
cc-env completion zsh >> ~/.zshrc

# fish
cc-env completion fish >> ~/.config/fish/completions/cc-env.fish
```

## Development

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## License

ISC © [lkangd](https://github.com/lkangd)
