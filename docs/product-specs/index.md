# cc-env CLI 规范（Final Draft）

Version: **1.0**
Status: **Ready for Implementation**

---

# 1. 项目目标（Objective）

构建一个基于 Node.js 的 CLI 工具：

```bash
cc-env
```

用于在运行时为 **Claude Code CLI** 注入一组预定义环境变量，从而支持：

- 多模型提供商切换（OpenAI / Azure / Anthropic / 自建）
- 不修改 `~/.claude/settings.json`
- 支持项目级配置
- 支持历史记录与回滚
- 支持安全管理 secrets
- 支持 deterministic runtime behavior

---

# 2. 核心设计原则（Design Principles）

## 2.1 Runtime 注入优先

永远：

```text
不修改 shell 环境
只在子进程中注入 env
```

---

## 2.2 幂等（Idempotent）

任何命令：

```text
重复执行不会破坏状态
```

---

## 2.3 可回滚（Reversible）

所有 destructive 操作必须：

```text
可恢复
```

---

## 2.4 Deterministic Behavior

相同输入：

```text
必须产生相同 env
```

---

# 3. 非目标（Non-Goals）

本工具不会：

```text
不实现 sandbox
不 hook Claude CLI
不管理 token 生命周期
不实现权限隔离
```

---

# 4. 配置存放目录结构（File System Layout）

默认：

```text
~/.cc-env/
```

结构：

```text
~/.cc-env/

config.json

presets/
    openai.json
    azure.json
    anthropic.json

history/
    2026-04-24T10-00-00.json

logs/
    cc-env.log
```

---

# 5. 数据结构（Schemas）

必须使用：

```text
zod validation
```

---

## 5.1 preset schema

```json
{
  "name": "openai",
  "createdAt": "2026-04-24T10:00:00Z",
  "updatedAt": "2026-04-24T10:00:00Z",
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.openai.com",
    "ANTHROPIC_AUTH_TOKEN": "sk-xxx"
  }
}
```

---

规则：

```text
env 必须是 flat object
value 必须是 string
key 必须匹配:

^[A-Z0-9_]+$
```

---

## 5.2 history schema

```json
{
  "timestamp": "2026-04-24T10:00:00Z",
  "action": "init",
  "movedKeys": ["ANTHROPIC_BASE_URL"],
  "backup": {
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com"
  }
}
```

---

# 6. 环境变量优先级（Critical）

优先级必须固定：

```text
1. project env
2. preset
3. process env
4. ~/.claude/settings.json
```

---

## 6.1 project env

路径：

```text
./.cc-env/env.json
./.cc-env/env.yaml
```

---

## 示例

```bash
.cc-env/env.json
```

```json
{
  "ANTHROPIC_BASE_URL": "https://dev-api"
}
```

---

# 7. CLI 命令设计

---

# 7.1 启动命令

## 语法

```bash
cc-env --preset=<name> <command>
```

---

## 示例

```bash
cc-env --preset=openai claude
```

---

## 行为

cc-env：

```text
load preset
merge env
spawn child process
inject env
```

---

## Node.js 实现规范

必须：

```js
spawn(command, args, {
  stdio: 'inherit',
  env: mergedEnv
})
```

---

不能：

```js
exec()
```

---

## 错误

```text
Preset not found: openai
```

exit code:

```text
1
```

---

# 7.2 init

## 命令

```bash
cc-env --init
```

---

## 目标

迁移：

```text
~/.claude/settings.json
```

中的：

```json
env
```

到：

```text
~/.cc-env/history
```

---

## React Ink UI

```text
Move env from settings.json

[✓] ANTHROPIC_AUTH_TOKEN
    sk-1234********

[✓] ANTHROPIC_BASE_URL
    https://api.openai.com

[ ] CUSTOM_VAR
    custom

Confirm move?

(Y/N)
```

---

## 行为

```text
backup env
remove env from settings.json
write history
```

---

## 幂等

如果：

```text
env 不存在
```

输出：

```text
No env field found
```

---

# 7.3 restore

## 命令

```bash
cc-env restore
```

---

## React Ink UI

```text
Restore record

2026-04-24 10:00

ANTHROPIC_BASE_URL
    https://api.openai.com

Confirm restore?

(Y/N)
```

---

## 冲突处理

```text
Key already exists

Overwrite?

(Y/N)
```

---

# 7.4 preset create

---

## 命令

```bash
cc-env preset create
```

---

## 支持方式

---

### 方式 1 — 交互

```bash
cc-env preset create
```

React Ink：

```text
Select variables:

[✓] ANTHROPIC_AUTH_TOKEN
[✓] ANTHROPIC_BASE_URL
[ ] CUSTOM_VAR
```

---

### 方式 2 — 文件导入

```bash
cc-env preset create --file env.yaml
```

---

支持：

```yaml
ANTHROPIC_BASE_URL: https://api.openai.com
```

---

### 方式 3 — inline

```bash
cc-env preset create \
  ANTHROPIC_BASE_URL=https://api.openai.com \
  ANTHROPIC_AUTH_TOKEN=xxx
```

---

## 限制

必须：

```text
flat object only
```

---

# 7.5 preset list

## 命令

```bash
cc-env preset list
```

---

输出：

```text
NAME        UPDATED        VARS
openai      2026-04-24     6
azure       2026-04-23     5
```

---

# 7.6 preset show

## 命令

```bash
cc-env preset show openai
```

---

输出：

```text
Preset: openai

ANTHROPIC_BASE_URL
    https://api.openai.com

ANTHROPIC_AUTH_TOKEN
    sk-1234********
```

---

## 安全规则

必须 mask：

```text
*_TOKEN
*_KEY
*_SECRET
```

---

# 7.7 preset delete

```bash
cc-env preset delete openai
```

---

必须：

```text
Confirm delete?

(Y/N)
```

---

# 7.8 preset edit

```bash
cc-env preset edit openai
```

---

默认：

```text
use $EDITOR
```

---

# 7.9 debug（强烈建议）

## 命令

```bash
cc-env debug
```

---

输出：

```text
Active env:

Source: preset=openai

ANTHROPIC_BASE_URL
    https://api.openai.com

ANTHROPIC_AUTH_TOKEN
    sk-1234********
```

---

# 8. React Ink 使用范围（明确）

必须：

```text
只用于复杂交互
```

---

使用：

```text
preset create
init
restore
interactive select
```

---

不使用：

```text
preset list
preset show
debug
```

---

原因：

```text
保持 CLI 简洁
避免性能开销
```

---

# 9. 环境变量合并逻辑（Deterministic）

必须按顺序：

```text
settings.json env
→ process.env
→ preset
→ project env
```

---

示例：

```text
settings.json:

BASE_URL=a

process.env:

BASE_URL=b

preset:

BASE_URL=c

project:

BASE_URL=d
```

---

最终：

```text
BASE_URL=d
```

---

# 10. 技术栈（Final）

---

## Runtime

```text
Node.js >= 20
TypeScript
```

---

## CLI

```text
commander
```

---

## UI

```text
react ink
@inkjs/ui
```

---

## validation

```text
zod
```

---

## file utils

```text
fs-extra
```

---

## YAML

```text
yaml
```

---

## spawn

```text
cross-spawn
```

---

## concurrency

```text
proper-lockfile
```

---

## logging

```text
pino
```

---

# 11. 安全要求（Mandatory）

---

## 禁止打印：

```text
TOKEN
SECRET
KEY
PASSWORD
```

---

## 必须：

```text
mask sensitive values
```

---

示例：

```text
sk-123456********
```

---

# 12. 并发控制（Mandatory）

所有写操作必须：

```text
file lock
```

---

否则：

```text
history corruption
```

---

推荐：

```text
proper-lockfile
```

---

# 13. Shell 兼容性（Mandatory）

必须支持：

```text
bash
zsh
fish
```

---

不能：

```text
依赖 shell 行为
```

---

# 14. 可测试性（Mandatory）

---

## dry run

```bash
cc-env --dry-run
```

---

输出：

```text
Would run:

ANTHROPIC_BASE_URL=https://api.openai.com

claude
```

---

不执行：

```text
spawn
write file
```

---

# 15. Logging 规范

---

日志：

```text
~/.cc-env/logs/cc-env.log
```

---

必须记录：

```text
timestamp
command
result
error
```

---

不能记录：

```text
token
secret
key
```

---

# 16. 错误处理规范

---

所有错误必须：

```text
human readable
no stack trace
exit code
```

---

示例：

```text
Preset not found: openai
```

exit:

```text
1
```

---

# 17. 引用

### [claude code 官方支持 env](../references/claude-code-env.md)
