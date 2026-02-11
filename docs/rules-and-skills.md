# 规则与技能

## 规则系统

规则是 JSON 格式的行为指令，用于在特定上下文中自动注入指导信息到 CLAUDE.md。

### 规则文件格式

```json
{
  "id": "rule-workflow",
  "name": "Workflow Execution Protocol",
  "description": "Guides the project-iterate workflow for all multi-step tasks",
  "priority": 10,
  "scope": "all",
  "pattern": ".*",
  "action": "warn",
  "category": "workflow",
  "enabled": true,
  "tags": ["workflow", "protocol"],
  "keywords": [],
  "content": "### 规则标题\n\n规则正文（Markdown 格式）..."
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 规则唯一标识 |
| `name` | `string` | 规则名称 |
| `description` | `string` | 规则描述（用于提示增强的语义匹配） |
| `priority` | `number` | 优先级（数值越大越优先） |
| `scope` | `string` | 作用域：`all` 表示全局生效 |
| `pattern` | `string` | 正则表达式模式匹配 |
| `action` | `string` | 触发动作类型 |
| `category` | `string` | 分类标签 |
| `enabled` | `boolean` | 是否启用 |
| `tags` | `string[]` | 标签列表 |
| `keywords` | `string[]` | 关键词列表 |
| `content` | `string` | 规则正文（Markdown，注入到 CLAUDE.md） |

### 作用域

规则支持两个作用域：

- **全局**（`~/.claude-habitat/rules/`）— 所有项目共享
- **项目级**（`.claude-habitat/rules/`）— 仅当前项目生效

### 管理工具

- `habitat_rule_create` — 创建规则（自动刷新 CLAUDE.md）
- `habitat_rule_read` — 读取规则
- `habitat_rule_update` — 更新规则（自动刷新 CLAUDE.md）
- `habitat_rule_delete` — 删除规则（自动刷新 CLAUDE.md）
- `habitat_rule_list` — 列出所有规则

规则的增删改会自动触发 CLAUDE.md 重新生成，确保 Claude 始终看到最新的规则内容。

### 内置规则

| 规则 | 说明 |
|------|------|
| `rule-workflow` | 工作流执行协议，引导 `project-iterate` 技能的使用 |

## 技能系统

技能是 Markdown 格式的可复用执行协议，定义了 Claude 在特定场景下应遵循的步骤和流程。

### 技能文件格式

技能文件由 YAML frontmatter 和 Markdown 正文组成：

```markdown
---
name: project-iterate
description: "Self-recursive project iteration protocol."
version: 4.0.0
tags: [workflow, iteration, core]
category: workflow
difficulty: advanced
---

# project-iterate

## Purpose
...

## Entry Point
...
```

### YAML Frontmatter 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 技能名称（用于 `habitat_skill_resolve` 调用） |
| `description` | `string` | 技能描述（用于语义匹配） |
| `version` | `string` | 版本号 |
| `tags` | `string[]` | 标签列表 |
| `category` | `string` | 分类 |
| `difficulty` | `string` | 难度级别 |

### `@import` 指令

技能支持通过 `@import` 引入其他技能的内容：

```markdown
@import("other-skill-name")
```

`habitat_skill_resolve` 默认会递归解析所有 `@import` 引用（可通过 `resolveImports: false` 禁用）。

### 作用域

- **全局**（`~/.claude-habitat/skills/`）— 所有项目共享
- **项目级**（`.claude-habitat/skills/`）— 仅当前项目生效

### 管理工具

- `habitat_skill_create` — 创建技能
- `habitat_skill_read` — 读取技能
- `habitat_skill_update` — 更新技能
- `habitat_skill_delete` — 删除技能及其符号链接
- `habitat_skill_list` — 列出所有技能
- `habitat_skill_resolve` — 加载并解析技能协议（含 `@import` 解析）

### 内置技能

| 技能 | 说明 |
|------|------|
| `project-iterate` | 自递归项目迭代协议，驱动所有多步任务的叶节点执行循环 |

## 命令系统

命令是用户可直接通过斜杠调用的快捷操作（如 `/habitat-init`）。命令文件为 Markdown 格式，以 `<!-- claude-habitat-command -->` 标记开头。

### 命令文件格式

```markdown
<!-- claude-habitat-command -->
# /habitat-init

Initialize Claude Habitat in the current project directory.

Use the `habitat_project_init` MCP tool to initialize claude-habitat in this project. This will:
1. Create the `.claude-habitat/` directory structure
2. ...

$ARGUMENTS
```

`$ARGUMENTS` 是占位符，运行时会被用户传入的参数替换。

### 作用域

- **全局**（`~/.claude-habitat/commands/`）— 所有项目共享
- **项目级**（`.claude-habitat/commands/`）— 仅当前项目生效

命令通过符号链接注册到 `~/.claude/commands/`（全局）或 `.claude/commands/`（项目级），使 Claude Code 能够识别斜杠命令。

### 管理工具

- `habitat_command_create` — 创建命令
- `habitat_command_read` — 读取命令
- `habitat_command_update` — 更新命令
- `habitat_command_delete` — 删除命令及其符号链接
- `habitat_command_list` — 列出所有命令

### 内置命令

| 命令 | 说明 |
|------|------|
| `/habitat-init` | 在当前项目初始化 claude-habitat |
| `/habitat-status` | 查看项目和工作流状态 |
| `/habitat-next` | 根据工作流状态建议下一步操作 |
| `/habitat-help` | 显示帮助信息 |

## 提示增强

提示增强（Prompt Augmentation）是 claude-habitat 的核心能力之一，通过两阶段 LLM 管线自动将相关规则和技能注入 Claude 的上下文。

### 工作原理

提示增强通过 Claude Code 的 `UserPromptSubmit` 钩子触发，在用户每次提交输入时自动运行。

**第一阶段：提取（Extraction）**

使用轻量模型（默认 `claude-haiku-4-5-20250901`）从用户输入中提取：
- `keywords` — 关键词列表
- `summary` — 输入摘要

**第二阶段：匹配（Matching）**

将提取结果与已注册的规则和技能进行语义匹配：
- 对每条规则/技能计算置信度分数（0.0–1.0）
- 超过 `confidenceThreshold`（默认 0.6）的结果被选中
- 最多选择 `maxMatchedRules`（默认 5）条规则和 `maxMatchedSkills`（默认 3）个技能

匹配到的规则内容和技能引用会作为 `<system-reminder>` 注入到 Claude 的上下文中。

### 配置

提示增强需要 API 密钥才能工作。配置位于 `config.json` 的 `promptAugmentor` 字段，详见 [配置参考](configuration.md)。

禁用提示增强：

```json
{
  "promptAugmentor": { "enabled": false },
  "skillMatcher": { "enabled": false }
}
```

### 技能匹配器（SkillMatcher）

技能匹配器是提示增强的补充组件，用于在安装时和 CLAUDE.md 生成时确定规则与技能的关联关系。

当 SkillMatcher 不可用时（如未配置 API 密钥），系统回退到内置的静态映射表 `RULE_SKILL_MAP`。

### 相关工具

- `habitat_session_stats` — 查看当前会话的规则触发和技能调用统计，用于规则反馈循环
