# 配置参考

## 配置文件位置

| 级别 | 路径 | 说明 |
|------|------|------|
| 全局 | `~/.claude-habitat/config.json` | 所有项目共享 |
| 项目 | `.claude-habitat/config.json` | 仅当前项目生效 |

## 三层回退机制

配置加载顺序：**内置默认值 → 全局配置 → 项目配置**。

后加载的配置覆盖先加载的。项目配置优先级最高。如果某个字段在项目配置中未定义，则回退到全局配置；全局也未定义则使用内置默认值。

## 完整字段参考

### `promptAugmentor` — 提示增强

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `apiKey` | `string` | — | Anthropic API 密钥（必填，启用增强时） |
| `model` | `string` | `claude-haiku-4-5-20250901` | 用于提取和匹配的模型 |
| `endpoint` | `string` | `https://api.anthropic.com` | API 端点 |
| `confidenceThreshold` | `number` | `0.6` | 匹配置信度阈值（0.0–1.0） |
| `maxMatchedRules` | `number` | `5` | 单次增强最多匹配的规则数 |
| `maxMatchedSkills` | `number` | `3` | 单次增强最多匹配的技能数 |
| `enabled` | `boolean` | `true` | 是否启用提示增强 |
| `timeoutMs` | `number` | `10000` | 增强请求超时时间（毫秒） |

### `skillMatcher` — 技能匹配器

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `apiKey` | `string` | — | Anthropic API 密钥 |
| `model` | `string` | `claude-haiku-4-5-20250901` | 匹配模型 |
| `endpoint` | `string` | `https://api.anthropic.com` | API 端点 |
| `confidenceThreshold` | `number` | `0.6` | 匹配置信度阈值 |
| `maxSkillsPerRule` | `number` | `3` | 每条规则最多关联的技能数 |
| `enabled` | `boolean` | `true` | 是否启用 |

### `security` — 安全

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `rateLimit.maxRequests` | `number` | `100` | 时间窗口内最大请求数 |
| `rateLimit.windowMs` | `number` | `60000` | 时间窗口（毫秒） |
| `maxInputLength` | `number` | `100000` | 单次输入最大字符数 |

### `documents` — 文档

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxTags` | `number` | `8` | 单个文档最大标签数 |
| `minTags` | `number` | `2` | 单个文档最少标签数 |
| `maxKeywords` | `number` | `50` | 单个文档最大关键词数 |
| `maxNameLength` | `number` | `200` | 文档名称最大长度 |
| `maxSummaryLength` | `number` | `500` | 文档摘要最大长度 |

### `workflows` — 工作流

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxDepth` | `number` | `10` | 工作流树最大深度 |
| `maxNodes` | `number` | `1000` | 工作流树最大节点数 |

### `logging` — 日志

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `level` | `string` | `info` | 日志级别：`debug` / `info` / `warn` / `error` |

### `bridge` — MCP 桥接

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `servers` | `BridgeServerConfig[]` | `[]` | 桥接的外部 MCP 服务器列表 |

每个 `BridgeServerConfig`：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 服务器名称 |
| `command` | `string` | 是 | 启动命令 |
| `args` | `string[]` | 是 | 命令参数 |
| `env` | `Record<string, string>` | 否 | 环境变量 |
| `enabled` | `boolean` | 否 | 是否启用 |

### 顶层字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `projectName` | `string` | — | 项目名称 |
| `projectId` | `string` | — | 项目 ID |
| `version` | `string` | `1.0.0` | 配置版本 |

## 配置示例

### 最小配置（启用增强）

```json
{
  "promptAugmentor": {
    "apiKey": "sk-ant-...",
    "enabled": true
  },
  "skillMatcher": {
    "apiKey": "sk-ant-...",
    "enabled": true
  }
}
```

### 完整配置

```json
{
  "version": "1.0.0",
  "logging": { "level": "info" },
  "security": {
    "rateLimit": { "maxRequests": 100, "windowMs": 60000 },
    "maxInputLength": 100000
  },
  "documents": {
    "maxTags": 8,
    "minTags": 2,
    "maxKeywords": 50,
    "maxNameLength": 200,
    "maxSummaryLength": 500
  },
  "workflows": {
    "maxDepth": 10,
    "maxNodes": 1000
  },
  "promptAugmentor": {
    "apiKey": "sk-ant-...",
    "model": "claude-haiku-4-5-20250901",
    "endpoint": "https://api.anthropic.com",
    "confidenceThreshold": 0.6,
    "maxMatchedRules": 5,
    "maxMatchedSkills": 3,
    "enabled": true,
    "timeoutMs": 10000
  },
  "skillMatcher": {
    "apiKey": "sk-ant-...",
    "model": "claude-haiku-4-5-20250901",
    "endpoint": "https://api.anthropic.com",
    "confidenceThreshold": 0.6,
    "maxSkillsPerRule": 3,
    "enabled": true
  },
  "bridge": {
    "servers": [
      {
        "name": "example-server",
        "command": "node",
        "args": ["path/to/server.js"],
        "env": { "API_KEY": "..." },
        "enabled": true
      }
    ]
  }
}
```

### 禁用增强

```json
{
  "promptAugmentor": {
    "enabled": false
  },
  "skillMatcher": {
    "enabled": false
  }
}
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `ANTHROPIC_AUTH_TOKEN` | 安装时自动检测，可用于提示增强的 API 密钥来源 |
| `ANTHROPIC_BASE_URL` | 安装时自动检测，可用于自定义 API 端点 |

安装脚本 `install.mjs` 会依次从 `~/.claude/settings.json` 的 `env` 字段和 `~/.claude.json` 的 `mcpServers` 环境变量中检测这些值。
