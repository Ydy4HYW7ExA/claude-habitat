/**
 * Shared SDK result → AiResult mapper.
 * Used by both AiClient and SessionManager.
 */
import type { AiResult, SdkResultMessage } from './types.js';

export function mapSdkResult(msg: SdkResultMessage): AiResult {
  if (msg.subtype === 'success') {
    return {
      text: msg.result ?? '',
      sessionId: msg.session_id ?? '',
      costUsd: msg.total_cost_usd ?? 0,
      durationMs: msg.duration_ms ?? 0,
      numTurns: msg.num_turns ?? 0,
      structured: msg.structured_output,
      status: 'success',
    };
  }

  const statusMap: Record<string, AiResult['status']> = {
    error_max_turns: 'max_turns',
    error_max_budget_usd: 'max_budget',
  };

  return {
    text: '',
    sessionId: msg.session_id ?? '',
    costUsd: msg.total_cost_usd ?? 0,
    durationMs: msg.duration_ms ?? 0,
    numTurns: msg.num_turns ?? 0,
    status: statusMap[msg.subtype] ?? 'error',
    error: msg.errors?.join('\n'),
  };
}
