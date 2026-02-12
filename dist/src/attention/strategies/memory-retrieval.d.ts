import type { AttentionInput, AttentionOutput, AttentionStrategy } from '../types.js';
/**
 * Priority 30 — Retrieves relevant memories and injects them into the prompt.
 * Prioritizes higher-layer memories (Insight > Category > Trace > Episode).
 */
export declare class MemoryRetrievalStrategy implements AttentionStrategy {
    name: string;
    priority: number;
    private maxEntries;
    constructor(maxEntries?: number);
    enhance(input: AttentionInput): Promise<AttentionOutput>;
    private formatMemories;
}
//# sourceMappingURL=memory-retrieval.d.ts.map