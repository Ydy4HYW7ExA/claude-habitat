# MCP 工具参考

claude-habitat 通过 MCP 协议暴露 36 个工具，分为 7 个类别。所有工具名称以 `claude-habitat` 为 MCP 服务器前缀。

## 文档工具（6 个）

### `habitat_doc_create`

创建新文档。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 文档名称 |
| `summary` | `string` | 是 | 文档摘要 |
| `tags` | `string[]` | 是 | 标签列表（2–8 个） |
| `content` | `string` | 否 | 文档正文 |
| `keywords` | `string[]` | 否 | 关键词列表 |
| `refs` | `string[]` | 否 | 引用的其他文档 ID |

返回：`{ documentId: string }`

### `habitat_doc_read`

按 ID 读取文档。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 文档 ID |
| `view` | `"summary" \| "full"` | 否 | 视图模式（默认 `summary`） |

返回：`{ found: boolean, document: Document }`

### `habitat_doc_update`

更新已有文档。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 文档 ID |
| `updates` | `object` | 是 | 要更新的字段 |

返回：`{ documentId: string }`

### `habitat_doc_delete`

删除文档。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 文档 ID |

返回：`{ deleted: boolean, documentId: string }`

### `habitat_doc_list`

查询文档列表，支持过滤和排序。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tags` | `string[]` | 否 | 按标签过滤 |
| `keyword` | `string` | 否 | 按关键词搜索 |
| `limit` | `number` | 否 | 返回数量限制 |
| `offset` | `number` | 否 | 分页偏移 |
| `sortBy` | `"name" \| "createdAt" \| "updatedAt"` | 否 | 排序字段 |
| `sortOrder` | `"asc" \| "desc"` | 否 | 排序方向 |

返回：文档列表

### `habitat_doc_graph`

获取文档的引用图谱。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 文档 ID |
| `depth` | `number` | 否 | 遍历深度（默认 1） |

返回：`{ center, nodes, edges, stats: { nodeCount, edgeCount } }`

## 工作流工具（10 个）

### `habitat_workflow_create`

创建新工作流。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 工作流名称 |
| `description` | `string` | 是 | 工作流描述 |
| `rootNode` | `object` | 是 | 根节点定义（含 `type`, `name`, `description`, `children`） |
| `maxDepth` | `number` | 否 | 最大树深度 |

返回：`{ workflowId: string, message: string }`

### `habitat_workflow_load`

从存储加载工作流树。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `workflowId` | `string` | 是 | 工作流 ID |
| `includeState` | `boolean` | 否 | 是否包含执行状态（默认 `false`） |

返回：工作流树结构

### `habitat_workflow_expand`

展开复合节点，添加子节点。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `workflowId` | `string` | 是 | 工作流 ID |
| `nodeId` | `string` | 是 | 要展开的复合节点 ID |
| `children` | `object[]` | 是 | 子节点定义列表 |

返回：展开结果

### `habitat_workflow_update_status`

更新单个节点的状态。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `workflowId` | `string` | 是 | 工作流 ID |
| `nodeId` | `string` | 是 | 节点 ID |
| `status` | `string` | 是 | 新状态：`pending` / `in_progress` / `completed` / `failed` / `skipped` |

返回：更新结果

### `habitat_workflow_get_progress`

获取工作流进度摘要。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `workflowId` | `string` | 是 | 工作流 ID |

返回：进度统计信息

### `habitat_workflow_init_cursor`

初始化工作流的执行游标。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `workflowId` | `string` | 是 | 工作流 ID |

返回：游标初始化结果

### `habitat_workflow_status`

会话恢复辅助工具，返回当前活跃工作流状态。无需参数。

返回：`{ hasActiveWorkflow: boolean, workflowId?: string, ... }`

### `habitat_workflow_transition`

完成当前叶节点并转换到下一个节点。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `workflowId` | `string` | 是 | 工作流 ID |

返回三种 action 之一：
- `activate_leaf` — 激活下一个叶节点，包含 `node`、`todoItems` 和 `branchPath`（从根到叶节点父级的 ID 链）
- `expand_composite` — 需要展开复合节点，包含 `nodeId`
- `workflow_complete` — 工作流已完成，包含 `treeSummary` 和 `treeVisualization`

### `habitat_workflow_update_tree`

批量更新树结构（添加/删除/修改节点）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `workflowId` | `string` | 是 | 工作流 ID |
| `operations` | `object[]` | 是 | 操作列表 |

操作类型：
- `{ op: "add", parentId, node }` — 添加子节点
- `{ op: "remove", nodeId }` — 删除节点
- `{ op: "modify", nodeId, updates }` — 修改节点（name/description/status）

返回：更新结果

### `habitat_workflow_cursor_state`

获取当前游标位置和上下文。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `workflowId` | `string` | 是 | 工作流 ID |

返回：当前叶节点信息和树上下文

## 技能工具（1 个）

### `habitat_skill_resolve`

加载并解析技能协议，包括所有 `@import` 引用。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `skillName` | `string` | 是 | 技能名称（如 `project-iterate`） |
| `resolveImports` | `boolean` | 否 | 是否解析导入（默认 `true`） |

返回：解析后的技能协议内容

## 项目工具（3 个）

### `habitat_project_init`

在指定目录初始化 claude-habitat 环境。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `projectPath` | `string` | 是 | 项目绝对路径 |
| `projectName` | `string` | 否 | 项目名称（默认取目录名） |

返回：`{ projectId, projectName, habitatDir, claudeDir, configSources }`

### `habitat_project_info`

获取项目元数据和统计信息。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `projectPath` | `string` | 否 | 项目路径（默认当前目录） |

返回：`{ projectId, projectName, paths, stats: { documents, workflows }, status }`

### `habitat_project_configure`

配置项目的提示增强。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `projectPath` | `string` | 是 | 项目绝对路径 |
| `apiKey` | `string` | 否 | API 密钥 |
| `endpoint` | `string` | 否 | API 端点 |
| `model` | `string` | 否 | 模型名称 |
| `enabled` | `boolean` | 否 | 是否启用 |
| `useGlobalConfig` | `boolean` | 否 | 使用全局配置（跳过项目配置） |

返回：`{ configured, source, configPath?, enabled }`

## Habitat 文件工具（15 个）

Habitat 文件工具分为三组：命令（command）、技能（skill）、规则（rule），每组 5 个 CRUD + list 工具。所有工具都支持 `scope` 参数区分全局和项目级。

### 命令工具（5 个）

#### `habitat_command_create`

创建命令文件。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 命令名称（必须以 `habitat-` 开头，kebab-case） |
| `content` | `string` | 是 | Markdown 内容 |
| `scope` | `"global" \| "project"` | 是 | 作用域 |

#### `habitat_command_read`

读取命令文件。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 命令名称 |
| `scope` | `"global" \| "project"` | 是 | 作用域 |

#### `habitat_command_update`

更新命令文件。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 命令名称 |
| `content` | `string` | 是 | 新的 Markdown 内容 |
| `scope` | `"global" \| "project"` | 是 | 作用域 |

#### `habitat_command_delete`

删除命令文件及其符号链接。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 命令名称 |
| `scope` | `"global" \| "project"` | 是 | 作用域 |

#### `habitat_command_list`

列出所有命令。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `scope` | `"global" \| "project"` | 是 | 作用域 |

### 技能文件工具（5 个）

#### `habitat_skill_create`

创建技能文件。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 技能名称（必须以 `habitat-` 开头，kebab-case） |
| `content` | `string` | 是 | Markdown 内容 |
| `scope` | `"global" \| "project"` | 是 | 作用域 |

#### `habitat_skill_read`

读取技能文件。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 技能名称 |
| `scope` | `"global" \| "project"` | 是 | 作用域 |

#### `habitat_skill_update`

更新技能文件。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 技能名称 |
| `content` | `string` | 是 | 新的 Markdown 内容 |
| `scope` | `"global" \| "project"` | 是 | 作用域 |

#### `habitat_skill_delete`

删除技能文件及其符号链接。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 技能名称 |
| `scope` | `"global" \| "project"` | 是 | 作用域 |

#### `habitat_skill_list`

列出所有技能。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `scope` | `"global" \| "project"` | 是 | 作用域 |

### 规则工具（5 个）

#### `habitat_rule_create`

创建规则文件。创建后自动刷新 CLAUDE.md。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 规则名称（必须以 `habitat-` 开头，kebab-case） |
| `content` | `string` | 是 | JSON 内容 |
| `scope` | `"global" \| "project"` | 是 | 作用域 |

#### `habitat_rule_read`

读取规则文件。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 规则名称 |
| `scope` | `"global" \| "project"` | 是 | 作用域 |

#### `habitat_rule_update`

更新规则文件。更新后自动刷新 CLAUDE.md。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 规则名称 |
| `content` | `string` | 是 | 新的 JSON 内容 |
| `scope` | `"global" \| "project"` | 是 | 作用域 |

#### `habitat_rule_delete`

删除规则文件。删除后自动刷新 CLAUDE.md。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 规则名称 |
| `scope` | `"global" \| "project"` | 是 | 作用域 |

#### `habitat_rule_list`

列出所有规则。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `scope` | `"global" \| "project"` | 是 | 作用域 |

## 会话工具（1 个）

### `habitat_session_stats`

获取当前 MCP 会话的规则触发和技能调用统计。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `format` | `"json" \| "markdown"` | 否 | 输出格式（`markdown` 适合注入 Plan Mode） |

返回（JSON 格式）：
- `ruleTriggers` — 规则触发次数
- `skillInvocations` — 技能调用次数
- `unmatchedRules` — 未匹配的规则
- `totalToolCalls` — 总工具调用次数
- `sessionStartTime` — 会话开始时间

返回（Markdown 格式）：格式化的统计文本
