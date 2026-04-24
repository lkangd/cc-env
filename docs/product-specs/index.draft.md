# 从零开始构建一个基于 nodejs 的命令行工具

## 背景

claude code cli 在启动的时候，会读取环境变量中需要的配置，以作为启动参数，比如模型的基础请求地址：ANTHROPIC_BASE_URL。这些配置一般定义在 ~/.claude/settings.json 中的 env 字段。
现在有一个痛点，比如我有多家模型提供商，如果将配置写在 ~/.claude/settings.json 中，那么只能同时使用一家模型提供商，因此需要提供另外一种方式，让 claude code 在启动的时候可以指定提供商或者其他所有 claude code 支持的环境变量。

## 功能描述

### 使用方式

在终端命令行下，提供一种如下的调用方式来启动 claude code：

```bash
cc-env --preset=some-preset claude
```

运行后 cc-env 会将 some-preset（提前设置过的） 对应的一组预置的环境变量（claude code 支持），让 claude code 读到运行时配置。

### 初始化

使用 cc-env 进行初始化，主要做的是将 ~/.claude/settings.json 中 env 的字段，移动到全局环境变量中，调用后展示 env 中已经定义的环境变量，默认勾选中以下字段：

- ANTHROPIC_AUTH_TOKEN
- ANTHROPIC_BASE_URL
- ANTHROPIC_DEFAULT_HAIKU_MODEL
- ANTHROPIC_DEFAULT_OPUS_MODEL
- ANTHROPIC_DEFAULT_SONNET_MODEL
- ANTHROPIC_REASONING_MODEL

```bash
cc-env --init // or cc-env -i
```

初始化移动过的记录需要保存在 ~/.cc-env 文件夹中，每一次初始化都要记录，以便恢复的时候，可以让用户选择。

初始化可以重复执行，如果有字段覆盖，需要提示用户确认，一定要用户输入 Y 确认。

### 恢复

将初始化的移动的环境变量移动回 ~/.claude/settings.json 中 env 内。

通过文件夹的方式展示每一次初始化记录和对应的字段给用户查看，左边栏是时间（从上到下，倒叙），右边栏是涉及变动的字段。用户选中确认后，按 Y 确认回写。

### 创建预设

参数你根据最合适的方式定义。

预设默认放置在 ~/.cc-env 文件夹中，但是可以指定到当前文件夹下，如果是当前文件夹下，则自动创建 .cc-env 目录，并存放为 env.json，重复存放覆盖。

#### 展示预设列表

通过文件夹的方式展示所有预设，左边栏是时间（从上到下，倒叙），右边栏是对应的环境变量字段。

#### 文件导入

支持指定 claude code settings.json 文件路径，但是只会读取里面的 env 字段。

支持 yaml 格式的文件，支持 json。

限制：只支持 value 字段为非嵌套对象的输入，自动忽略不合法的值

#### 交互式导入

支持直接贴多行的 yaml 的输入和 json 输入。

限制：只支持 value 字段为非嵌套对象的输入，自动忽略不合法的值

#### 勾选时设置

基于 claude code 官方支持 env，让用户勾选需要设置的环境变量值，确认依次录入具体的值，默认勾选中以下字段：

- ANTHROPIC_AUTH_TOKEN
- ANTHROPIC_BASE_URL
- ANTHROPIC_DEFAULT_HAIKU_MODEL
- ANTHROPIC_DEFAULT_OPUS_MODEL
- ANTHROPIC_DEFAULT_SONNET_MODEL
- ANTHROPIC_REASONING_MODEL

限制：只支持 value 字段为非嵌套对象的输入，自动忽略不合法的值

#### 删除预设

参数你根据最合适的方式定义。

展示预设列表，选中确认后，输入 Y 删除

#### 编辑预设

参数你根据最合适的方式定义。

交互方式你来定。

#### 读取目录下的预设

cc-env 在启动时候，检查当前目录下 .cc-env/env.json 或者 .cc-env/env.yaml，如果存在，则当作较高优先级的环境变量使用。

## 要求

### 技术栈

基于 nodejs 为 base，选用最佳的 cli 实现技术栈

## 引用

### [claude code 官方支持 env](../references/claude-code-env.md)
