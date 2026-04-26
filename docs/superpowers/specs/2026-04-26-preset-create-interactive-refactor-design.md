# Preset Create 交互重构设计

## 目标

将 `preset create` 命令从半交互式（支持 CLI 参数直接执行）改为全交互式，去掉所有 CLI 参数（`-n`、`-f`、`--project`、`[pairs...]`），完全通过 ink UI 引导用户完成 preset 创建。

## 交互流程

```
source → filePath? → keys → manualInput? → name → destination → confirm → done
```

### 步骤说明

1. **source** — 选择数据来源：「文件导入（默认）」或「手动输入」，回车确认
2. **filePath**（仅文件导入）— 文本输入框输入文件路径，回车确认。支持 `.yaml`/`.yml`/`.json` 格式。读取失败时显示红色错误提示，允许重新输入
3. **keys**（仅文件导入）— 复用 init 的 checkbox 模式（j/k 上下、空格勾选、回车确认），展示从文件解析出的 key 供用户勾选
4. **manualInput**（仅手动输入）— 文本输入框输入 `KEY=VALUE` 回车添加，已添加的 key-value 实时显示，输入 `q` 结束
5. **name** — 文本输入框输入 preset 名称，回车确认
6. **destination** — 选择「全局 preset」或「项目 preset」，回车确认
7. **confirm** — 复用 `EnvSummary` 组件展示来源文件（如有）、保存路径、key-value 对，回车确认保存，`q` 取消

全局按键：`q`/Escape 在任意步骤退出。

## 架构变更

### Flow 状态机 (`src/flows/preset-create-flow.ts`)

从当前 5 步扩展为 7 步条件分支流程。State 新增字段：

- `source: 'file' | 'manual'`
- `filePath: string`
- `presetName: string`
- `destination: 'global' | 'project'`
- `env: EnvMap`（解析后的键值对）

路径分支：
- `source='file'` → `filePath` → `keys` → `name` → `destination` → `confirm` → `done`
- `source='manual'` → `manualInput` → `name` → `destination` → `confirm` → `done`

### Ink 组件 (`src/ink/preset-create-app.tsx`)

扩展渲染逻辑覆盖所有 7 个步骤。每步根据 flow state 的当前 step 渲染对应 UI。keys 步骤复用 init-app 的 checkbox 模式（j/k/空格/回车）。

### 命令层 (`src/commands/preset/create.ts`)

- 移除所有参数（`name`、`file`、`pairs`、`project`），命令函数无参数
- 不再有"有参数直接执行 vs 无参数交互"的分支
- 只调用 `renderFlow()` 拿结果，写入对应位置
- `buildPlaceholderEnv` 删除
- `readEnvFile` 和 `parseInlinePairs` 保留，由 ink 组件在交互中通过 renderFlow 回调调用

### CLI 注册 (`src/cli.ts`)

- 移除 `-n`、`-f`、`--project` flag 和 `[pairs...]` 参数
- 只保留裸命令 `preset create`

### 服务接口

`presetService.write()` 和 `projectEnvService.write()` 保持现有签名不变。

## 文件解析逻辑

在 `readEnvFile` 中增加 JSON env 字段处理：如果解析结果是对象且存在 `env` 字段（且 `env` 是对象），则使用 `env` 内的字段；否则使用第一层字段。

## 错误处理

- 文件不存在 / 无法读取 → 红色提示，停留在 filePath 步骤
- 文件格式不支持（非 .yaml/.yml/.json）→ 红色提示，重新输入
- 文件内容解析失败 → 红色提示，重新输入
- preset 名称为空 → 提示必须输入，停留在 name 步骤
- preset 名称已存在 → 提示已存在，可选择覆盖或重新输入

## 测试

- `readEnvFile` 的 JSON env 字段提取逻辑补单测
- flow 状态机的条件分支路径补单测（file 路径 vs manual 路径）
- 命令函数验证 renderFlow 结果正确路由到对应 service
