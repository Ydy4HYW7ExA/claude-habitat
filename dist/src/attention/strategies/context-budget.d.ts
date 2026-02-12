import type { AttentionInput, AttentionOutput, AttentionStrategy } from '../types.js';
/**
 * Priority 50 — Controls context budget by estimating token usage
 * and trimming lower-priority content when over budget.
 */
export declare class ContextBudgetStrategy implements AttentionStrategy {
    name: string;
    priority: number;
    private maxTokens;
    constructor(maxTokens?: number);
    enhance(input: AttentionInput): Promise<AttentionOutput>;
    private estimateTokens;
    private estimateText;
    private estimateHistory;
    private truncateToTokens;
}
//# sourceMappingURL=context-budget.d.ts.map