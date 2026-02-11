# Claude Habitat

通过 MCP（Model Context Protocol）为 Claude Code 提供结构化知识管理和工作流驱动能力。

## 功能概览

- **文档系统** — 带标签、关键词和引用图谱的结构化知识存储
- **工作流引擎** — 树状任务分解，支持游标驱动的叶节点执行循环
- **规则引擎** — JSON 规则文件，支持优先级、模式匹配和自动注入 CLAUDE.md
- **技能协议** — Markdown 格式的可复用执行协议，支持 `@import` 指令
- **命令系统** — 斜杠命令（`/habitat-*`），快速触发常用操作
- **提示增强** — 两阶段 LLM 管线，根据用户输入自动匹配规则和技能

## 前置要求

- Node.js >= 20
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)

## 快速开始

### 全局安装

```bash
git clone <repo-url> claude-habitat
cd claude-habitat
npm install
npm run build
node install.mjs
```

`install.mjs` 执行 8 个步骤：

1. 在 `~/.claude.json` 中注册 MCP 服务器
2. 安装预设技能到 `~/.claude-habitat/skills/`
3. 安装预设命令到 `~/.claude-habitat/commands/`
4. 安装预设规则到 `~/.claude-habitat/rules/`
5. 创建符号链接到 `~/.claude/skills/` 和 `~/.claude/commands/`
6. 注入 CLAUDE.md 标记段落到 `~/.claude/CLAUDE.md`
7. 在 `~/.claude/settings.json` 中注册 UserPromptSubmit 钩子
8. 交互式配置提示增强（API 密钥、端点、模型）

### 项目初始化

在 Claude Code 中运行：

```
/habitat-init
```

这会在当前项目中创建 `.claude-habitat/` 目录结构，复制预设文件，生成项目级 CLAUDE.md，并将 `.claude-habitat/` 加入 `.gitignore`。

## 斜杠命令

| 命令 | 说明 |
|------|------|
| `/habitat-init` | 在当前项目初始化 claude-habitat |
| `/habitat-status` | 查看项目和工作流状态 |
| `/habitat-next` | 根据工作流状态建议下一步操作 |
| `/habitat-help` | 显示帮助信息 |

## 核心概念

### 文档

带有标签（tags）、关键词（keywords）和引用关系（refs）的结构化知识单元。支持按标签/关键词查询和引用图谱遍历。数据以 JSON 文件存储在 `.claude-habitat/documents/` 中。

### 工作流

树状任务结构，由 composite（复合）和 atomic（原子）节点组成。通过游标（cursor）追踪当前执行位置，支持叶节点执行循环（Leaf Execution Cycle）驱动多步任务。核心技能 `project-iterate` 定义了四阶段循环：执行业务 → 设计迭代 → 规则反馈 → 状态转换。

### 规则

JSON 格式的行为规则，包含优先级、作用域、模式匹配等字段。规则变更时自动刷新 CLAUDE.md。支持全局（`~/.claude-habitat/rules/`）和项目级（`.claude-habitat/rules/`）两个作用域。

### 技能

Markdown 格式的可复用执行协议，带 YAML frontmatter 元数据。通过 `habitat_skill_resolve` 工具加载，支持 `@import` 指令引入其他技能。技能是工作流执行的核心驱动力。

### 命令

斜杠命令（`/habitat-*`）是用户可直接调用的快捷操作。命令文件为 Markdown 格式，存储在 `commands/` 目录中，通过符号链接注册到 Claude Code。

### 提示增强

两阶段 LLM 管线：第一阶段从用户输入中提取关键词和摘要，第二阶段将提取结果与已有规则/技能进行语义匹配。匹配到的规则和技能会自动注入到 Claude 的上下文中。通过 UserPromptSubmit 钩子触发。

## 目录结构

### 全局目录 `~/.claude-habitat/`

```
~/.claude-habitat/
├── config.json          # 全局配置（API 密钥、模型、阈值等）
├── skills/              # 技能文件（.md）
├── commands/            # 命令文件（.md）
├── rules/               # 规则文件（.json）
├── documents/           # 文档存储（.json）
└── workflows/           # 工作流存储（.json）
```

### 项目目录 `.claude-habitat/`

```
.claude-habitat/
├── marker.json          # 项目标识（projectId, projectName）
├── config.json          # 项目级配置（可选，覆盖全局）
├── skills/              # 项目级技能
├── commands/            # 项目级命令
├── rules/               # 项目级规则
├── documents/           # 项目文档
└── workflows/           # 项目工作流
```

## 配置

配置采用三层回退机制：**内置默认值 → 全局配置 → 项目配置**。项目配置优先级最高。

关键配置字段：

| 字段 | 说明 |
|------|------|
| `promptAugmentor.apiKey` | Anthropic API 密钥 |
| `promptAugmentor.model` | 增强模型（默认 `claude-haiku-4-5-20250901`） |
| `promptAugmentor.enabled` | 是否启用提示增强 |
| `skillMatcher.apiKey` | 技能匹配器 API 密钥 |
| `security.rateLimit` | 速率限制（默认 100 次/分钟） |

详细配置参考见 [docs/configuration.md](docs/configuration.md)。

## 卸载

1. 从 `~/.claude.json` 中移除 `mcpServers["claude-habitat"]`
2. 从 `~/.claude/settings.json` 中移除 UserPromptSubmit 钩子
3. 删除 `~/.claude-habitat/` 目录
4. 从 `~/.claude/CLAUDE.md` 中移除 `<!-- habitat-begin -->` 到 `<!-- habitat-end -->` 之间的内容
5. 删除 `~/.claude/skills/` 和 `~/.claude/commands/` 中的 `habitat-*` 符号链接

## 详细文档

- [配置参考](docs/configuration.md)
- [MCP 工具参考](docs/tools-reference.md)
- [工作流使用指南](docs/workflow-guide.md)
- [规则与技能](docs/rules-and-skills.md)
