// Centralized constants — single source of truth for the entire codebase.
// No magic strings, numbers, or inline literals elsewhere.

// ─── Path Constants ──────────────────────────────────────────────────

/** Root directory name for habitat runtime data */
export const HABITAT_DIR = '.claude-habitat';

/** New directory structure: program/data/process */
export const PROGRAM_DIR = 'program';
export const PROGRAM_SDK_DIR = 'sdk';
export const PROGRAM_APP_DIR = 'app';
export const DATA_DIR = 'data';
export const SHARED_DATA_ID = '_shared';
export const PROCESS_DIR = 'process';
export const MANIFEST_FILE = 'manifest.json';
export const LINKS_FILE = '_links.json';

/** Position subdirectory names */
export const ENTRIES_SUBDIR = 'entries';
export const RULES_SUBDIR = 'rules';
export const SKILLS_SUBDIR = 'skills';
export const SESSIONS_SUBDIR = 'sessions';

/** File names */
export const CONFIG_FILE = 'config.json';
export const STATE_FILE = 'state.json';
export const INDEX_FILE = 'index.json';
export const META_FILE = 'meta.json';
export const HISTORY_FILE = 'history.json';
export const CLAUDE_MD_FILE = 'CLAUDE.md';

/** File extensions */
export const JSON_EXT = '.json';
export const JSONL_EXT = '.jsonl';

// ─── Position & Task Status ─────────────────────────────────────────

/** Position status values */
export const POSITION_STATUS = {
  IDLE: 'idle',
  BUSY: 'busy',
  ERROR: 'error',
  STOPPED: 'stopped',
} as const;

/** Task status values */
export const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
} as const;

/** Task priority values */
export const TASK_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

/** Priority ordering for task queue sorting (lower = higher priority) */
export const PRIORITY_ORDER: Record<string, number> = {
  [TASK_PRIORITY.CRITICAL]: 0,
  [TASK_PRIORITY.HIGH]: 1,
  [TASK_PRIORITY.NORMAL]: 2,
  [TASK_PRIORITY.LOW]: 3,
};

// ─── Memory Layer ───────────────────────────────────────────────────

/** Memory layer names */
export const MEMORY_LAYER = {
  EPISODE: 'episode',
  TRACE: 'trace',
  CATEGORY: 'category',
  INSIGHT: 'insight',
} as const;

/** All memory layers as array (for Zod enums, iteration) */
export const MEMORY_LAYERS = [
  MEMORY_LAYER.EPISODE,
  MEMORY_LAYER.TRACE,
  MEMORY_LAYER.CATEGORY,
  MEMORY_LAYER.INSIGHT,
] as const;

// ─── Model Names ────────────────────────────────────────────────────

/** AI model identifiers */
export const MODEL = {
  OPUS: 'opus',
  SONNET: 'sonnet',
  HAIKU: 'haiku',
} as const;

/** All model names as array (for Zod enums) */
export const MODELS = [MODEL.OPUS, MODEL.SONNET, MODEL.HAIKU] as const;

// ─── Event Types ────────────────────────────────────────────────────

/** Event type prefix for task events */
export const TASK_EVENT_PREFIX = 'task.';

/** Well-known event types */
export const EVENT_TYPE = {
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',
  POSITION_STATUS_REPORT: 'position.status_report',
  WORKFLOW_CHANGE_REQUEST: 'workflow.change_request',
} as const;

/** Event type constant for task creation (used to avoid re-dispatch loops) */
export const TASK_CREATED_TYPE = 'created';

/** Wildcard event subscription */
export const EVENT_WILDCARD = '*';

// ─── MCP Tool Names ────────────────────────────────────────────────

/** Position-level MCP tool names */
export const TOOL_NAME = {
  REMEMBER: 'remember',
  RECALL: 'recall',
  FORGET: 'forget',
  REWRITE_MEMORY: 'rewrite_memory',
  RECALL_GLOBAL: 'recall_global',
  REMEMBER_GLOBAL: 'remember_global',
  EMIT_TASK: 'emit_task',
  GET_MY_TASKS: 'get_my_tasks',
  REPORT_STATUS: 'report_status',
  REQUEST_WORKFLOW_CHANGE: 'request_workflow_change',
} as const;

/** Admin MCP tool names */
export const ADMIN_TOOL_NAME = {
  CREATE_ROLE_TEMPLATE: 'create_role_template',
  CREATE_POSITION: 'create_position',
  MODIFY_POSITION: 'modify_position',
  DELETE_POSITION: 'delete_position',
  MODIFY_WORKFLOW: 'modify_workflow',
  LIST_POSITIONS: 'list_positions',
  GET_POSITION_STATUS: 'get_position_status',
  DISPATCH_TASK: 'dispatch_task',
} as const;

/** Tool name referenced in workflow injection prompt */
export const REQUEST_WORKFLOW_CHANGE_TOOL = 'request_workflow_change';

// ─── MCP Server ─────────────────────────────────────────────────────

/** MCP server naming */
export const MCP_SERVER_PREFIX = 'habitat-';
export const MCP_ADMIN_SERVER_NAME = 'habitat-admin';

/** Project config version */
export const CONFIG_VERSION = '0.1.0';

// ─── SDK Configuration ──────────────────────────────────────────────

/** Claude Code system prompt preset */
export const SDK_SYSTEM_PROMPT_PRESET = 'claude_code';

/** Default permission mode for positions */
export const DEFAULT_PERMISSION_MODE = 'bypassPermissions';

/** Default setting sources for position isolation */
export const DEFAULT_SETTING_SOURCES = ['project'] as const;

// ─── Admin Tool Config ──────────────────────────────────────────────

/** Fields safe to modify via modify_position admin tool */
export const ADMIN_SAFE_FIELDS = new Set([
  'status', 'config', 'outputRoutes', 'programName',
]);

// ─── ID Generation ──────────────────────────────────────────────────

/** Nanoid lengths for ID generation */
export const NANOID_LENGTH_POSITION = 6;
export const NANOID_LENGTH_TASK = 8;
export const NANOID_LENGTH_EVENT = 10;
export const NANOID_LENGTH_MEMORY = 12;

/** ID prefixes */
export const ID_PREFIX = {
  TASK: 'task-',
  EVENT: 'evt-',
} as const;

export const MEMORY_ID_PREFIX = {
  EPISODE: 'e-',
  TRACE: 't-',
  CATEGORY: 'c-',
  INSIGHT: 'i-',
} as const;

// ─── Admin Position ─────────────────────────────────────────────────

/** Admin position ID */
export const ORG_ARCHITECT_ID = 'org-architect';

// ─── Dispatcher ────────────────────────────────────────────────────

/** Dispatcher position ID and role template name */
export const DISPATCHER_ID = 'dispatcher';
export const DISPATCHER_ROLE_TEMPLATE = 'dispatcher';

// ─── MCP Bridge ────────────────────────────────────────────────────

/** MCP Bridge file names */
export const MCP_BRIDGE_SOCKET_FILE = '.mcp.sock';
export const MCP_BRIDGE_CONFIG_FILE = '.mcp-bridge.json';
export const MCP_BRIDGE_SERVER_NAME = 'habitat-bridge';

// ─── Session ───────────────────────────────────────────────────────

/** Session status values */
export const SESSION_STATUS = {
  STARTING: 'starting',
  READY: 'ready',
  BUSY: 'busy',
  CLOSED: 'closed',
} as const;

// ─── CLI ────────────────────────────────────────────────────────────

/** Source position ID used by CLI commands */
export const CLI_SOURCE_ID = 'cli';

/** Default task type when none specified */
export const DEFAULT_TASK_TYPE = 'default';

export const BOOTSTRAP_TASK_TYPE = 'bootstrap';

/** CLI flag names */
export const CLI_FLAG_PROJECT_ROOT = '--project-root';

// ─── Polling & Timeouts ─────────────────────────────────────────────

/** Default send timeout for session manager (aligned with positionTimeout) */
export const DEFAULT_SEND_TIMEOUT_MS = 600_000;

/** Default config values */
export const DEFAULT_POLL_INTERVAL_MS = 1000;
export const DEFAULT_BOOTSTRAP_POLL_INTERVAL_MS = 2000;
export const DEFAULT_BOOTSTRAP_TIMEOUT_MS = 600_000;

// ─── Memory Defaults ────────────────────────────────────────────────

/** Memory defaults */
export const SUMMARY_MAX_LENGTH = 100;
export const RELEVANCE_DECAY_FACTOR = 0.1;
export const MIN_GLOBAL_MEMORY_BUDGET = 3;

/** Default limits for memory operations */
export const DEFAULT_SEARCH_LIMIT = 10;
export const DEFAULT_LIST_LIMIT = 50;
export const DEFAULT_RECALL_LIMIT = 5;

/** Default per-store limit in cross-search */
export const DEFAULT_CROSS_SEARCH_LIMIT = 5;

/** Default status event history limit */
export const DEFAULT_STATUS_EVENT_LIMIT = 5;

/** History construction: search limits */
export const HISTORY_FAILURE_SEARCH_LIMIT = 3;
export const HISTORY_INSIGHT_SEARCH_LIMIT = 2;

/** Index engine: minimum keyword length */
export const MIN_KEYWORD_LENGTH = 2;

/** Index engine: tokenization regex */
export const TOKENIZE_REGEX = /[^\w\s\u4e00-\u9fff-]/g;

/** Index engine: initial version */
export const INDEX_VERSION = 1;

// ─── Concurrency ────────────────────────────────────────────────────

/** Default concurrency config — single source of truth for init.ts and run.ts */
export const DEFAULT_CONCURRENCY_CONFIG = {
  maxConcurrentPositions: 3,
  maxConcurrentAiCalls: 2,
  positionTimeout: 600_000,
} as const;

// ─── Attention Pipeline ─────────────────────────────────────────────

/** Context budget allocation ratios (used when over token limit) */
export const PROMPT_BUDGET_RATIO = 0.7;
export const SYSTEM_BUDGET_RATIO = 0.2;

/** Attention strategy defaults */
export const DEFAULT_MAX_CONTEXT_TOKENS = 100_000;
export const DEFAULT_CHARS_PER_TOKEN = 3;
export const CHARS_PER_TOKEN_LATIN = 4;
export const CHARS_PER_TOKEN_CJK = 1.5;
export const DEFAULT_MAX_HISTORY_TURNS = 6;
export const DEFAULT_MAX_MEMORY_ENTRIES = 10;

/** Max characters for payload injection in attention strategies */
export const MAX_PAYLOAD_DISPLAY_LENGTH = 500;

/** Context budget truncation notice */
export const CONTEXT_TRUNCATION_NOTICE = '\n\n[... 内容因上下文预算限制被截断 ...]';

/** History construction: query for failure-related memories */
export const FAILURE_SEARCH_QUERY = 'failed error mistake problem';

/** Memory retrieval: layer priority order (highest first) */
export const LAYER_PRIORITY: readonly ('insight' | 'category' | 'trace' | 'episode')[] = [
  'insight', 'category', 'trace', 'episode',
] as const;

/** Global memory budget divisor for cross-search and retrieval */
export const GLOBAL_MEMORY_BUDGET_DIVISOR = 2;

/** Memory retrieval: layer display labels */
export const LAYER_LABELS: Record<string, string> = {
  [MEMORY_LAYER.INSIGHT]: '💡 洞察',
  [MEMORY_LAYER.CATEGORY]: '📂 类目',
  [MEMORY_LAYER.TRACE]: '📋 轨迹',
  [MEMORY_LAYER.EPISODE]: '📝 片段',
};

// ─── AI Defaults ────────────────────────────────────────────────────

/** Default AI config values (shared between init.ts and runtime-factory.ts) */
export const DEFAULT_AI_MODEL = 'sonnet';
export const DEFAULT_AI_MAX_TURNS = 30;
export const DEFAULT_AI_MAX_BUDGET_USD = 1.0;

/** Bootstrap AI config */
export const BOOTSTRAP_AI_CONFIG = {
  model: 'opus',
  maxTurns: 50,
  maxBudgetUsd: 5.0,
} as const;

// ─── Prompt Templates ───────────────────────────────────────────────
// All Chinese prompt strings centralized here for future i18n.

export const PROMPT = {
  // Role framing (attention strategy)
  POSITION_IDENTITY: (positionId: string) => `## 岗位身份: ${positionId}`,
  ROLE_LABEL: (name: string, desc: string) => `职业: ${name} — ${desc}`,
  CURRENT_TASK_HEADER: '## 当前任务',
  TASK_TYPE_LABEL: (type: string) => `类型: ${type}`,
  TASK_SOURCE_LABEL: (source: string) => `来源: ${source}`,
  TASK_PRIORITY_LABEL: (priority: string) => `优先级: ${priority}`,
  TASK_DATA_LABEL: '数据: ',
  PAYLOAD_TRUNCATED: '\n...(truncated)',
  SUPPLEMENTARY_HEADER: '## 补充指令',

  // Workflow injection (attention strategy)
  WORKFLOW_HEADER: '## 你当前的工作流程',
  WORKFLOW_DESCRIPTION: '以下是驱动你的工作流代码。你正在执行其中的某个步骤。',
  WORKFLOW_CHANGE_HINT: (toolName: string) => `如果你认为流程需要改进，可以使用 ${toolName} 工具提出修改建议。`,

  // Memory retrieval (attention strategy)
  MEMORY_SECTION_HEADER: '## 相关经验和记忆',
  MEMORY_KEYWORDS_LABEL: (keywords: string) => `_关键词: ${keywords}_`,

  // History construction (attention strategy)
  HISTORY_FAILURE_QUESTION: (taskRef: string) => `关于 ${taskRef}，你之前的经验是什么？`,
  HISTORY_FAILURE_ANSWER: (content: string, summary: string) => `根据我的经验，${content}\n\n关键教训：${summary}`,
  HISTORY_INSIGHT_QUESTION: '关于这类任务，有什么最佳实践？',

  // CLAUDE.md generation
  CLAUDE_MD_TITLE: (positionId: string) => `# 你是 ${positionId} 岗位`,
  CLAUDE_MD_ROLE: (name: string) => `## 职业: ${name}`,
  CLAUDE_MD_MEMORY_HEADER: '## 记忆指令',
  CLAUDE_MD_MEMORY_INSTRUCTIONS: [
    '- 每次完成任务后，用 remember 工具记录关键决策和原因',
    '- 遇到问题时，先用 recall 工具查询是否有相关经验',
    '- 重要洞察用 remember_global 写入全局记忆库',
  ],

  // Consolidator
  CONSOLIDATION_ENTRY_FORMAT: (id: string, summary: string, content: string, keywords: string) =>
    `[${id}] ${summary}\n内容: ${content}\n关键词: ${keywords}`,
  CONSOLIDATION_LAYER_DESCRIPTIONS: {
    [MEMORY_LAYER.EPISODE]: '原始片段',
    [MEMORY_LAYER.TRACE]: '任务轨迹（关联多个片段的完整记录）',
    [MEMORY_LAYER.CATEGORY]: '主题类目（某个主题的知识汇总）',
    [MEMORY_LAYER.INSIGHT]: '高阶洞察（跨主题的规律和最佳实践）',
  } as Record<string, string>,
  CONSOLIDATION_PROMPT: (count: number, layerDesc: string, entrySummaries: string) =>
    `请将以下${count}条记忆整合为一条${layerDesc}。

## 源记忆条目

${entrySummaries}

## 要求

1. 合并重复信息，保留关键细节
2. 提炼出更高层次的理解
3. 生成简洁的摘要（一句话）
4. 提取关键词（用于检索）

请以 JSON 格式输出：
{
  "content": "整合后的完整内容",
  "summary": "一句话摘要",
  "keywords": ["关键词1", "关键词2", ...]
}`,

  // Todo injection (attention strategy)
  TODO_HEADER: '## 当前待办',
  TODO_ITEM_PENDING: (text: string) => `- [ ] ${text}`,
  TODO_ITEM_DONE: (text: string) => `- [x] ${text}`,
} as const;

// ─── Helpers ────────────────────────────────────────────────────────

/** Truncate content to summary length */
export function truncateSummary(content: string): string {
  return content.slice(0, SUMMARY_MAX_LENGTH);
}

/** Shared timestamp formatter for logging (HH:MM:SS) */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString().slice(11, 19);
}

/** Create an MCP text response content block */
export function mcpText(text: string): { type: 'text'; text: string } {
  return { type: 'text' as const, text };
}
