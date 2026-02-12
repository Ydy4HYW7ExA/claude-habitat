import type { AttentionInput, AttentionOutput, AttentionStrategy } from '../types.js';
/**
 * Priority 20 — Injects workflow source code into the prompt.
 * Lets the AI see and reason about its own workflow.
 */
export declare class WorkflowInjectionStrategy implements AttentionStrategy {
    name: string;
    priority: number;
    enhance(input: AttentionInput): Promise<AttentionOutput>;
}
//# sourceMappingURL=workflow-injection.d.ts.map