import type { AttentionInput, AttentionOutput, AttentionStrategy } from '../types.js';
import type { MemoryEntry, MemoryLayer } from '../../memory/types.js';
import { MIN_GLOBAL_MEMORY_BUDGET, DEFAULT_MAX_MEMORY_ENTRIES, LAYER_PRIORITY, GLOBAL_MEMORY_BUDGET_DIVISOR, PROMPT, LAYER_LABELS } from '../../constants.js';

/**
 * Priority 30 — Retrieves relevant memories and injects them into the prompt.
 * Prioritizes higher-layer memories (Insight > Category > Trace > Episode).
 */
export class MemoryRetrievalStrategy implements AttentionStrategy {
  name = 'memory-retrieval';
  priority = 30;

  private maxEntries: number;

  constructor(maxEntries = DEFAULT_MAX_MEMORY_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  async enhance(input: AttentionInput): Promise<AttentionOutput> {
    const { context } = input;
    const { memoryStore, globalMemoryStore } = context;

    const query = input.prompt;

    const collected: MemoryEntry[] = [];
    const seen = new Set<string>();

    const addUnique = (entries: MemoryEntry[]) => {
      for (const entry of entries) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        collected.push(entry);
      }
    };

    // Search position-specific memory, prioritizing higher layers
    for (const layer of LAYER_PRIORITY) {
      if (collected.length >= this.maxEntries) break;
      const remaining = this.maxEntries - collected.length;
      const results = await memoryStore.search(query, { layer, limit: remaining });
      addUnique(results);
    }

    // Also search global memory (up to half the budget)
    const globalBudget = Math.max(MIN_GLOBAL_MEMORY_BUDGET, Math.floor(this.maxEntries / GLOBAL_MEMORY_BUDGET_DIVISOR));
    const globalResults = await globalMemoryStore.search(query, { limit: globalBudget });
    addUnique(globalResults);

    if (collected.length === 0) return input;

    const memorySection = this.formatMemories(collected);

    return {
      ...input,
      prompt: input.prompt + '\n\n' + memorySection,
    };
  }

  private formatMemories(entries: MemoryEntry[]): string {
    const lines: string[] = [PROMPT.MEMORY_SECTION_HEADER, ''];

    for (const entry of entries) {
      const layerLabel = LAYER_LABELS[entry.layer] ?? entry.layer;
      lines.push(`### [${layerLabel}] ${entry.summary}`);
      lines.push(entry.content);
      lines.push(PROMPT.MEMORY_KEYWORDS_LABEL(entry.keywords.join(', ')));
      lines.push('');
    }

    return lines.join('\n');
  }
}
