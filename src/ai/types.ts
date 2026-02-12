// AI domain types

import type { AiResult, AiResultStatus } from '../workflow/types.js';

export interface AiClientConfig {
  defaultModel: string;
  defaultMaxTurns: number;
  defaultMaxBudgetUsd: number;
  projectRoot: string;
}

export interface AiCallOptions {
  systemPromptAppend?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  cwd?: string;
  resume?: string;
  fork?: boolean;
  outputFormat?: { type: 'json_schema'; schema: Record<string, unknown> };
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
  mcpServers?: Record<string, unknown>;
  permissionMode?: string;
  extraMcpTools?: unknown[];
  hooks?: Record<string, unknown[]>;
  abortController?: AbortController;
}

export { AiResult, AiResultStatus };

/** SDK message types — minimal shape for the fields we consume */
export interface SdkResultMessage {
  type: 'result';
  subtype: 'success' | 'error_max_turns' | 'error_max_budget_usd' | string;
  result?: string;
  session_id?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
  structured_output?: unknown;
  errors?: string[];
}
