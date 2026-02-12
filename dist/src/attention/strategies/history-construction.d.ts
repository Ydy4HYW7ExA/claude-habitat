import type { AttentionInput, AttentionOutput, AttentionStrategy } from '../types.js';
/**
 * Priority 40 — Constructs virtual conversation history.
 * Implements "prophet perspective" and "failure erasure":
 * - Turns past failures into lessons learned
 * - Injects cross-position insights as self-knowledge
 */
export declare class HistoryConstructionStrategy implements AttentionStrategy {
    name: string;
    priority: number;
    private maxHistoryTurns;
    constructor(maxHistoryTurns?: number);
    enhance(input: AttentionInput): Promise<AttentionOutput>;
}
//# sourceMappingURL=history-construction.d.ts.map