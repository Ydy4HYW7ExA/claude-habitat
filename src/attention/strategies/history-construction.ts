import type { AttentionInput, AttentionOutput, AttentionStrategy, ConversationTurn } from '../types.js';

import {
  DEFAULT_MAX_HISTORY_TURNS, FAILURE_SEARCH_QUERY, MEMORY_LAYER,
  HISTORY_FAILURE_SEARCH_LIMIT, HISTORY_INSIGHT_SEARCH_LIMIT, PROMPT,
} from '../../constants.js';

/**
 * Priority 40 — Constructs virtual conversation history.
 * Implements "prophet perspective" and "failure erasure":
 * - Turns past failures into lessons learned
 * - Injects cross-position insights as self-knowledge
 */
export class HistoryConstructionStrategy implements AttentionStrategy {
  name = 'history-construction';
  priority = 40;

  private maxHistoryTurns: number;

  constructor(maxHistoryTurns = DEFAULT_MAX_HISTORY_TURNS) {
    this.maxHistoryTurns = maxHistoryTurns;
  }

  async enhance(input: AttentionInput): Promise<AttentionOutput> {
    const { context } = input;
    const { memoryStore, task } = context;

    const history: ConversationTurn[] = input.conversationHistory
      ? [...input.conversationHistory]
      : [];

    // Search for failure-related memories to rewrite as lessons
    const failureMemories = await memoryStore.search(FAILURE_SEARCH_QUERY, { limit: HISTORY_FAILURE_SEARCH_LIMIT });
    for (const mem of failureMemories) {
      if (history.length >= this.maxHistoryTurns) break;
      history.push(
        { role: 'user', content: PROMPT.HISTORY_FAILURE_QUESTION(mem.metadata?.taskId ?? task.type) },
        { role: 'assistant', content: PROMPT.HISTORY_FAILURE_ANSWER(mem.content, mem.summary) },
      );
    }

    // Search for insights to inject as self-knowledge
    const insights = await memoryStore.search(task.type, { layer: MEMORY_LAYER.INSIGHT, limit: HISTORY_INSIGHT_SEARCH_LIMIT });
    for (const insight of insights) {
      if (history.length >= this.maxHistoryTurns) break;
      history.push(
        { role: 'user', content: PROMPT.HISTORY_INSIGHT_QUESTION },
        { role: 'assistant', content: insight.content },
      );
    }

    // Inject cross-position insights from global memory as self-knowledge
    const { globalMemoryStore } = context;
    if (globalMemoryStore && globalMemoryStore !== memoryStore) {
      const globalInsights = await globalMemoryStore.search(task.type, { layer: MEMORY_LAYER.INSIGHT, limit: HISTORY_INSIGHT_SEARCH_LIMIT });
      for (const insight of globalInsights) {
        if (history.length >= this.maxHistoryTurns) break;
        history.push(
          { role: 'user', content: PROMPT.HISTORY_INSIGHT_QUESTION },
          { role: 'assistant', content: insight.content },
        );
      }
    }

    if (history.length === 0) return input;

    return {
      ...input,
      conversationHistory: history,
    };
  }
}
