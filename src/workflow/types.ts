// Workflow domain types

import type { MemoryEntry, MemoryStore } from '../memory/types.js';
import type { Position, RoleTemplate, Task } from '../position/types.js';

export type WorkflowFunction = (ctx: WorkflowContext) => Promise<void>;

export interface WorkflowContext {
  ai(prompt: string, options?: AiOptions): Promise<AiResult>;

  emit(taskType: string, payload: unknown, targetPositionId?: string): Promise<void>;
  call(targetPositionId: string, taskType: string, payload: unknown): Promise<unknown>;

  memory: {
    remember(content: string, keywords?: string[]): Promise<string>;
    recall(query: string, limit?: number): Promise<MemoryEntry[]>;
    forget(id: string, reason: string): Promise<void>;
    rewrite(id: string, newContent: string): Promise<void>;
    recallGlobal(query: string, limit?: number): Promise<MemoryEntry[]>;
    rememberGlobal(content: string, keywords?: string[]): Promise<string>;
  };

  /**
   * Ask the human user a question (maps to Claude Code's AskUserQuestion tool).
   * Returns the user's response text. Use for human-in-the-loop workflows.
   */
  askUser(question: string): Promise<string>;

  /**
   * Execute multiple ai() calls in parallel (maps to Claude Code's Task tool
   * for sub-agent parallelism). Returns results in the same order as prompts.
   */
  parallel(calls: { prompt: string; options?: AiOptions }[]): Promise<AiResult[]>;

  /**
   * Manage a structured task list for the current workflow execution
   * (maps to Claude Code's TodoWrite tool for attention enhancement).
   * Helps the AI track progress and avoid drift during complex workflows.
   */
  todo: {
    add(item: string): void;
    complete(item: string): void;
    list(): TodoItem[];
  };

  position: Position;
  roleTemplate: RoleTemplate;
  projectRoot: string;

  task: Task;
  args: unknown;

  signal: AbortSignal;
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;
}

export interface TodoItem {
  text: string;
  done: boolean;
}

export interface AiOptions {
  systemPromptAppend?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  model?: 'opus' | 'sonnet' | 'haiku';
  maxTurns?: number;
  maxBudgetUsd?: number;

  resume?: string;
  fork?: boolean;

  outputFormat?: { type: 'json_schema'; schema: Record<string, unknown> };

  injectWorkflowCode?: boolean;
  attentionOverrides?: string[];
  memoryQuery?: string;

  extraMcpTools?: unknown[];

  /** Claude Code hooks to attach to this ai() call */
  hooks?: HookConfig;
}

/**
 * Hook configuration for ai() calls.
 * Maps Claude Code hook event names to handler arrays.
 * Supported events: PreToolUse, PostToolUse, SubagentStart, SubagentStop,
 * PreCompact, Notification, Stop, etc.
 */
export interface HookConfig {
  PostToolUse?: HookHandler[];
  PreToolUse?: HookHandler[];
  PreCompact?: HookHandler[];
  [key: string]: HookHandler[] | undefined;
}

export interface HookHandler {
  /** Shell command to execute, or 'builtin:memory-extract' for auto-extraction */
  command: string;
  /** Matcher pattern — which tools to trigger on (glob) */
  matcher?: string;
}

export type AiResultStatus = 'success' | 'error' | 'max_turns' | 'max_budget' | 'aborted';

export interface AiResult {
  text: string;
  sessionId: string;
  costUsd: number;
  durationMs: number;
  numTurns: number;
  structured?: unknown;
  status: AiResultStatus;
  error?: string;
}

export interface WorkflowLoaderInterface {
  load(workflowPath: string): Promise<WorkflowFunction>;
  invalidate(workflowPath: string): void;
}
