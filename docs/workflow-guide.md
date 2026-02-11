# 工作流使用指南

## 核心概念

### 树状结构

工作流是一棵由节点组成的树。节点分两种类型：

- **composite**（复合节点）— 包含子节点，本身不执行业务逻辑
- **atomic**（原子节点/叶节点）— 实际执行工作的最小单元

### 节点状态

每个节点有以下状态之一：

| 状态 | 说明 |
|------|------|
| `pending` | 等待执行 |
| `in_progress` | 正在执行 |
| `completed` | 已完成 |
| `failed` | 执行失败 |
| `skipped` | 已跳过 |

### 游标（Cursor）

游标追踪当前正在执行的叶节点位置。通过 `habitat_workflow_init_cursor` 初始化，通过 `habitat_workflow_transition` 推进。游标维护：
- `leafHistory` — 已访问的叶节点 ID 列表
- `branchPath` — 从根节点到当前叶节点父级的完整 ID 链，提供项目全局上下文

### 转换（Transition）

`habitat_workflow_transition` 完成当前叶节点后，返回三种 action：

- `activate_leaf` — 下一个叶节点已就绪，直接进入执行。返回中包含 `branchPath`（从根到叶节点父级的 ID 链）
- `expand_composite` — 遇到未展开的复合节点，需要先用 `habitat_workflow_expand` 添加子节点
- `workflow_complete` — 所有叶节点已完成，工作流结束

## 完整示例

### 1. 创建工作流

```
habitat_workflow_create({
  name: "重构认证模块",
  description: "将认证逻辑从控制器中抽离为独立服务",
  rootNode: {
    type: "composite",
    name: "重构认证模块",
    description: "根节点",
    children: [
      {
        type: "atomic",
        name: "分析现有代码",
        description: "阅读现有认证相关代码，理解依赖关系"
      },
      {
        type: "composite",
        name: "实现重构",
        description: "执行具体的重构工作",
        children: [
          {
            type: "atomic",
            name: "创建 AuthService",
            description: "抽离认证逻辑到独立服务类"
          },
          {
            type: "atomic",
            name: "更新控制器",
            description: "修改控制器使用新的 AuthService"
          }
        ]
      },
      {
        type: "atomic",
        name: "补充测试",
        description: "为 AuthService 编写单元测试"
      }
    ]
  }
})
```

返回 `workflowId`。

### 2. 初始化游标并开始执行

```
habitat_workflow_init_cursor({ workflowId: "<workflowId>" })
habitat_workflow_transition({ workflowId: "<workflowId>" })
```

`habitat_workflow_transition` 返回 `activate_leaf`，包含第一个叶节点"分析现有代码"的信息。

### 3. 执行叶节点

在叶节点中完成实际工作后，再次调用 `habitat_workflow_transition` 推进到下一个节点。

```
habitat_workflow_transition({ workflowId: "<workflowId>" })
```

### 4. 处理转换结果

如果返回 `activate_leaf`，继续执行下一个叶节点。

如果返回 `expand_composite`，需要先展开复合节点：

```
habitat_workflow_expand({
  workflowId: "<workflowId>",
  nodeId: "<compositeNodeId>",
  children: [
    { type: "atomic", name: "子任务 1", description: "..." },
    { type: "atomic", name: "子任务 2", description: "..." }
  ]
})
```

然后再次调用 `habitat_workflow_transition` 激活第一个新叶节点。

### 5. 工作流完成

当所有叶节点执行完毕，`habitat_workflow_transition` 返回 `workflow_complete`，包含最终的 `treeSummary` 和 `treeVisualization`。

## project-iterate 技能

`project-iterate` 是 claude-habitat 的核心技能协议，定义了工作流的标准执行流程。通过 `habitat_skill_resolve("project-iterate")` 加载。

### 四阶段叶节点执行循环

每个叶节点的执行遵循四个阶段：

**Part 1 — 执行业务**
实际的工作内容。根据叶节点描述创建 TodoList 项目并逐一完成。如果多个项目之间无依赖，可标记 `parallelizable: true` 并使用 Task 子代理并行执行。种子叶节点的 Part 1 为空。

**Part 2 — 增量树变更**
结构性的核心阶段。基于 Part 1 的成果，对工作树执行增量操作：添加子树（composite + atomic 节点）、删除过时节点、修改描述。使用 Plan Mode 探索上下文并设计变更，结果通过 `habitat_doc_create` 持久化，然后通过 `habitat_workflow_update_tree` 或 `habitat_workflow_expand` 应用到工作流树。每次 Part 2 是对树的一次编辑操作，树是持久的、累积的。

**Part 2.5 — 规则反馈**
调用 `habitat_session_stats` 审查会话中的规则活动，根据需要创建或更新规则。

**Part 3 — 状态转换**
调用 `habitat_workflow_transition` 完成当前叶节点，根据返回的 action 进入下一个叶节点或完成工作流。

## 种子工作流模式

当任务需要 ≥ 3 步但尚不清楚完整结构时，使用种子工作流模式：

```
habitat_workflow_create({
  name: "<任务名称>",
  description: "<任务描述>",
  rootNode: {
    type: "composite",
    name: "<根节点名称>",
    description: "<根节点描述>",
    children: [
      {
        type: "atomic",
        name: "Seed: design work tree",
        description: "Empty execution — Part 2 will design the full work tree structure."
      }
    ]
  }
})
```

种子叶节点的 Part 1 没有业务工作。进入 Part 2 后，通过 Plan Mode 探索代码库并设计完整的工作树结构，然后通过 `habitat_workflow_update_tree` 添加所有后续节点。

## 跨会话恢复

工作流状态持久化在 `.claude-habitat/workflows/` 中。新会话开始时：

1. 调用 `habitat_workflow_status()`（无参数）
2. 如果 `hasActiveWorkflow: true`，返回当前工作流 ID 和游标状态
3. 调用 `habitat_skill_resolve("project-iterate")` 加载执行协议
4. 从当前叶节点的 Part 1 继续执行

这使得长时间运行的多步任务可以跨多个 Claude Code 会话持续推进。

## 辅助工具

### 查看进度

```
habitat_workflow_get_progress({ workflowId: "<workflowId>" })
```

返回 `TreeSummary`：总节点数、叶节点数、已完成/待处理叶节点数、未展开的复合节点数。

### 批量修改树结构

```
habitat_workflow_update_tree({
  workflowId: "<workflowId>",
  operations: [
    { op: "add", parentId: "<parentId>", node: { type: "atomic", name: "...", description: "..." } },
    { op: "remove", nodeId: "<nodeId>" },
    { op: "modify", nodeId: "<nodeId>", updates: { name: "新名称", description: "新描述" } }
  ]
})
```

### 查看游标状态

```
habitat_workflow_cursor_state({ workflowId: "<workflowId>" })
```

返回当前叶节点信息和树上下文。
