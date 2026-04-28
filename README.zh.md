<p align="center">
  <img src="./statics/logo.png" alt="cc-env" width="320" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@lkangd/cc-env"><img src="https://img.shields.io/npm/v/@lkangd/cc-env.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@lkangd/cc-env"><img src="https://img.shields.io/npm/dm/@lkangd/cc-env.svg" alt="npm downloads" /></a>
  <a href="https://github.com/lkangd/cc-env/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@lkangd/cc-env.svg" alt="license" /></a>
</p>

<p align="center">为 <a href="https://claude.ai/code">Claude Code</a> 管理运行时环境变量</p>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh.md">简体中文</a>
</p>

---

## 概述

`cc-env` 是一个 CLI 工具，让你可以为 Claude Code 定义、切换和恢复环境变量配置——支持按项目配置或使用可复用的预设。不再需要手动编辑 `settings.json` 或在不同工作区之间切换 `.env` 文件。

## 安装

### 通过 npm

```bash
npm install -g @lkangd/cc-env
```

需要 Node.js `>=20.19.2`。

### 通过 Homebrew

```bash
brew tap lkangd/tap
brew install cc-env
```

## 快速开始

```bash
# 1. 在项目中初始化 cc-env
cc-env init

# 2. 创建一个包含环境变量的预设
cc-env create

# 3. 使用预设运行 Claude Code
cc-env run
```

## 命令

| 命令 | 说明 |
|---|---|
| `cc-env init` | 为当前项目初始化 cc-env |
| `cc-env run [args...]` | 使用合并后的环境变量运行 Claude Code |
| `cc-env restore` | 从之前的快照恢复环境变量 |
| `cc-env show` | 列出并查看所有保存的预设 |
| `cc-env create` | 创建新的环境变量预设 |
| `cc-env edit <name>` | 编辑现有预设 |
| `cc-env rename <from> <to>` | 重命名预设 |
| `cc-env delete` | 删除保存的预设 |
| `cc-env doctor` | 检查系统健康状况和配置 |
| `cc-env completion` | 生成 shell 补全脚本 |

## 全局选项

```
--verbose        启用详细输出
--quiet          抑制非必要输出
--no-interactive 禁用交互式提示（等同于 -y）
```

## Shell 补全

```bash
# bash
cc-env completion bash >> ~/.bashrc

# zsh
cc-env completion zsh >> ~/.zshrc

# fish
cc-env completion fish >> ~/.config/fish/completions/cc-env.fish
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建
npm run build

# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage
```

## 许可证

ISC © [lkangd](https://github.com/lkangd)
