/** Root directory name for habitat runtime data */
export declare const HABITAT_DIR = ".claude-habitat";
/** New directory structure: program/data/process */
export declare const PROGRAM_DIR = "program";
export declare const PROGRAM_SDK_DIR = "sdk";
export declare const PROGRAM_APP_DIR = "app";
export declare const DATA_DIR = "data";
export declare const SHARED_DATA_ID = "_shared";
export declare const PROCESS_DIR = "process";
export declare const MANIFEST_FILE = "manifest.json";
export declare const LINKS_FILE = "_links.json";
/** Position subdirectory names */
export declare const ENTRIES_SUBDIR = "entries";
export declare const RULES_SUBDIR = "rules";
export declare const SKILLS_SUBDIR = "skills";
export declare const SESSIONS_SUBDIR = "sessions";
/** File names */
export declare const CONFIG_FILE = "config.json";
export declare const STATE_FILE = "state.json";
export declare const INDEX_FILE = "index.json";
export declare const META_FILE = "meta.json";
export declare const HISTORY_FILE = "history.json";
export declare const CLAUDE_MD_FILE = "CLAUDE.md";
/** File extensions */
export declare const JSON_EXT = ".json";
export declare const JSONL_EXT = ".jsonl";
/** Position status values */
export declare const POSITION_STATUS: {
    readonly IDLE: "idle";
    readonly BUSY: "busy";
    readonly ERROR: "error";
    readonly STOPPED: "stopped";
};
/** Task status values */
export declare const TASK_STATUS: {
    readonly PENDING: "pending";
    readonly RUNNING: "running";
    readonly DONE: "done";
    readonly FAILED: "failed";
};
/** Task priority values */
export declare const TASK_PRIORITY: {
    readonly LOW: "low";
    readonly NORMAL: "normal";
    readonly HIGH: "high";
    readonly CRITICAL: "critical";
};
/** Priority ordering for task queue sorting (lower = higher priority) */
export declare const PRIORITY_ORDER: Record<string, number>;
/** Memory layer names */
export declare const MEMORY_LAYER: {
    readonly EPISODE: "episode";
    readonly TRACE: "trace";
    readonly CATEGORY: "category";
    readonly INSIGHT: "insight";
};
/** All memory layers as array (for Zod enums, iteration) */
export declare const MEMORY_LAYERS: readonly ["episode", "trace", "category", "insight"];
/** AI model identifiers */
export declare const MODEL: {
    readonly OPUS: "opus";
    readonly SONNET: "sonnet";
    readonly HAIKU: "haiku";
};
/** All model names as array (for Zod enums) */
export declare const MODELS: readonly ["opus", "sonnet", "haiku"];
/** Event type prefix for task events */
export declare const TASK_EVENT_PREFIX = "task.";
/** Well-known event types */
export declare const EVENT_TYPE: {
    readonly TASK_CREATED: "task.created";
    readonly TASK_COMPLETED: "task.completed";
    readonly TASK_FAILED: "task.failed";
    readonly POSITION_STATUS_REPORT: "position.status_report";
    readonly WORKFLOW_CHANGE_REQUEST: "workflow.change_request";
};
/** Event type constant for task creation (used to avoid re-dispatch loops) */
export declare const TASK_CREATED_TYPE = "created";
/** Wildcard event subscription */
export declare const EVENT_WILDCARD = "*";
/** Position-level MCP tool names */
export declare const TOOL_NAME: {
    readonly REMEMBER: "remember";
    readonly RECALL: "recall";
    readonly FORGET: "forget";
    readonly REWRITE_MEMORY: "rewrite_memory";
    readonly RECALL_GLOBAL: "recall_global";
    readonly REMEMBER_GLOBAL: "remember_global";
    readonly EMIT_TASK: "emit_task";
    readonly GET_MY_TASKS: "get_my_tasks";
    readonly REPORT_STATUS: "report_status";
    readonly REQUEST_WORKFLOW_CHANGE: "request_workflow_change";
};
/** Admin MCP tool names */
export declare const ADMIN_TOOL_NAME: {
    readonly CREATE_ROLE_TEMPLATE: "create_role_template";
    readonly CREATE_POSITION: "create_position";
    readonly MODIFY_POSITION: "modify_position";
    readonly DELETE_POSITION: "delete_position";
    readonly MODIFY_WORKFLOW: "modify_workflow";
    readonly LIST_POSITIONS: "list_positions";
    readonly GET_POSITION_STATUS: "get_position_status";
    readonly DISPATCH_TASK: "dispatch_task";
};
/** Tool name referenced in workflow injection prompt */
export declare const REQUEST_WORKFLOW_CHANGE_TOOL = "request_workflow_change";
/** MCP server naming */
export declare const MCP_SERVER_PREFIX = "habitat-";
export declare const MCP_ADMIN_SERVER_NAME = "habitat-admin";
/** Project config version */
export declare const CONFIG_VERSION = "0.1.0";
/** Claude Code system prompt preset */
export declare const SDK_SYSTEM_PROMPT_PRESET = "claude_code";
/** Default permission mode for positions */
export declare const DEFAULT_PERMISSION_MODE = "bypassPermissions";
/** Default setting sources for position isolation */
export declare const DEFAULT_SETTING_SOURCES: readonly ["project"];
/** Fields safe to modify via modify_position admin tool */
export declare const ADMIN_SAFE_FIELDS: Set<string>;
/** Nanoid lengths for ID generation */
export declare const NANOID_LENGTH_POSITION = 6;
export declare const NANOID_LENGTH_TASK = 8;
export declare const NANOID_LENGTH_EVENT = 10;
export declare const NANOID_LENGTH_MEMORY = 12;
/** ID prefixes */
export declare const ID_PREFIX: {
    readonly TASK: "task-";
    readonly EVENT: "evt-";
};
export declare const MEMORY_ID_PREFIX: {
    readonly EPISODE: "e-";
    readonly TRACE: "t-";
    readonly CATEGORY: "c-";
    readonly INSIGHT: "i-";
};
/** Admin position ID */
export declare const ORG_ARCHITECT_ID = "org-architect";
/** Dispatcher position ID and role template name */
export declare const DISPATCHER_ID = "dispatcher";
export declare const DISPATCHER_ROLE_TEMPLATE = "dispatcher";
/** MCP Bridge file names */
export declare const MCP_BRIDGE_SOCKET_FILE = ".mcp.sock";
export declare const MCP_BRIDGE_CONFIG_FILE = ".mcp-bridge.json";
export declare const MCP_BRIDGE_SERVER_NAME = "habitat-bridge";
/** Session status values */
export declare const SESSION_STATUS: {
    readonly STARTING: "starting";
    readonly READY: "ready";
    readonly BUSY: "busy";
    readonly CLOSED: "closed";
};
/** Source position ID used by CLI commands */
export declare const CLI_SOURCE_ID = "cli";
/** Default task type when none specified */
export declare const DEFAULT_TASK_TYPE = "default";
export declare const BOOTSTRAP_TASK_TYPE = "bootstrap";
/** CLI flag names */
export declare const CLI_FLAG_PROJECT_ROOT = "--project-root";
/** Default send timeout for session manager (aligned with positionTimeout) */
export declare const DEFAULT_SEND_TIMEOUT_MS = 600000;
/** Default config values */
export declare const DEFAULT_POLL_INTERVAL_MS = 1000;
export declare const DEFAULT_BOOTSTRAP_POLL_INTERVAL_MS = 2000;
export declare const DEFAULT_BOOTSTRAP_TIMEOUT_MS = 600000;
/** Memory defaults */
export declare const SUMMARY_MAX_LENGTH = 100;
export declare const RELEVANCE_DECAY_FACTOR = 0.1;
export declare const MIN_GLOBAL_MEMORY_BUDGET = 3;
/** Default limits for memory operations */
export declare const DEFAULT_SEARCH_LIMIT = 10;
export declare const DEFAULT_LIST_LIMIT = 50;
export declare const DEFAULT_RECALL_LIMIT = 5;
/** Default per-store limit in cross-search */
export declare const DEFAULT_CROSS_SEARCH_LIMIT = 5;
/** Default status event history limit */
export declare const DEFAULT_STATUS_EVENT_LIMIT = 5;
/** History construction: search limits */
export declare const HISTORY_FAILURE_SEARCH_LIMIT = 3;
export declare const HISTORY_INSIGHT_SEARCH_LIMIT = 2;
/** Index engine: minimum keyword length */
export declare const MIN_KEYWORD_LENGTH = 2;
/** Index engine: tokenization regex */
export declare const TOKENIZE_REGEX: RegExp;
/** Index engine: initial version */
export declare const INDEX_VERSION = 1;
/** Default concurrency config — single source of truth for init.ts and run.ts */
export declare const DEFAULT_CONCURRENCY_CONFIG: {
    readonly maxConcurrentPositions: 3;
    readonly maxConcurrentAiCalls: 2;
    readonly positionTimeout: 600000;
};
/** Context budget allocation ratios (used when over token limit) */
export declare const PROMPT_BUDGET_RATIO = 0.7;
export declare const SYSTEM_BUDGET_RATIO = 0.2;
/** Attention strategy defaults */
export declare const DEFAULT_MAX_CONTEXT_TOKENS = 100000;
export declare const DEFAULT_CHARS_PER_TOKEN = 3;
export declare const CHARS_PER_TOKEN_LATIN = 4;
export declare const CHARS_PER_TOKEN_CJK = 1.5;
export declare const DEFAULT_MAX_HISTORY_TURNS = 6;
export declare const DEFAULT_MAX_MEMORY_ENTRIES = 10;
/** Max characters for payload injection in attention strategies */
export declare const MAX_PAYLOAD_DISPLAY_LENGTH = 500;
/** Context budget truncation notice */
export declare const CONTEXT_TRUNCATION_NOTICE = "\n\n[... \u5185\u5BB9\u56E0\u4E0A\u4E0B\u6587\u9884\u7B97\u9650\u5236\u88AB\u622A\u65AD ...]";
/** History construction: query for failure-related memories */
export declare const FAILURE_SEARCH_QUERY = "failed error mistake problem";
/** Memory retrieval: layer priority order (highest first) */
export declare const LAYER_PRIORITY: readonly ('insight' | 'category' | 'trace' | 'episode')[];
/** Global memory budget divisor for cross-search and retrieval */
export declare const GLOBAL_MEMORY_BUDGET_DIVISOR = 2;
/** Memory retrieval: layer display labels */
export declare const LAYER_LABELS: Record<string, string>;
/** Default AI config values (shared between init.ts and runtime-factory.ts) */
export declare const DEFAULT_AI_MODEL = "sonnet";
export declare const DEFAULT_AI_MAX_TURNS = 30;
export declare const DEFAULT_AI_MAX_BUDGET_USD = 1;
/** Bootstrap AI config */
export declare const BOOTSTRAP_AI_CONFIG: {
    readonly model: "opus";
    readonly maxTurns: 50;
    readonly maxBudgetUsd: 5;
};
export declare const PROMPT: {
    readonly POSITION_IDENTITY: (positionId: string) => string;
    readonly ROLE_LABEL: (name: string, desc: string) => string;
    readonly CURRENT_TASK_HEADER: "## 当前任务";
    readonly TASK_TYPE_LABEL: (type: string) => string;
    readonly TASK_SOURCE_LABEL: (source: string) => string;
    readonly TASK_PRIORITY_LABEL: (priority: string) => string;
    readonly TASK_DATA_LABEL: "数据: ";
    readonly PAYLOAD_TRUNCATED: "\n...(truncated)";
    readonly SUPPLEMENTARY_HEADER: "## 补充指令";
    readonly WORKFLOW_HEADER: "## 你当前的工作流程";
    readonly WORKFLOW_DESCRIPTION: "以下是驱动你的工作流代码。你正在执行其中的某个步骤。";
    readonly WORKFLOW_CHANGE_HINT: (toolName: string) => string;
    readonly MEMORY_SECTION_HEADER: "## 相关经验和记忆";
    readonly MEMORY_KEYWORDS_LABEL: (keywords: string) => string;
    readonly HISTORY_FAILURE_QUESTION: (taskRef: string) => string;
    readonly HISTORY_FAILURE_ANSWER: (content: string, summary: string) => string;
    readonly HISTORY_INSIGHT_QUESTION: "关于这类任务，有什么最佳实践？";
    readonly CLAUDE_MD_TITLE: (positionId: string) => string;
    readonly CLAUDE_MD_ROLE: (name: string) => string;
    readonly CLAUDE_MD_MEMORY_HEADER: "## 记忆指令";
    readonly CLAUDE_MD_MEMORY_INSTRUCTIONS: readonly ["- 每次完成任务后，用 remember 工具记录关键决策和原因", "- 遇到问题时，先用 recall 工具查询是否有相关经验", "- 重要洞察用 remember_global 写入全局记忆库"];
    readonly CONSOLIDATION_ENTRY_FORMAT: (id: string, summary: string, content: string, keywords: string) => string;
    readonly CONSOLIDATION_LAYER_DESCRIPTIONS: Record<string, string>;
    readonly CONSOLIDATION_PROMPT: (count: number, layerDesc: string, entrySummaries: string) => string;
    readonly TODO_HEADER: "## 当前待办";
    readonly TODO_ITEM_PENDING: (text: string) => string;
    readonly TODO_ITEM_DONE: (text: string) => string;
};
/** Truncate content to summary length */
export declare function truncateSummary(content: string): string;
/** Shared timestamp formatter for logging (HH:MM:SS) */
export declare function formatTimestamp(date?: Date): string;
/** Create an MCP text response content block */
export declare function mcpText(text: string): {
    type: 'text';
    text: string;
};
//# sourceMappingURL=constants.d.ts.map