import type { AttentionInput, AttentionOutput, AttentionStrategy } from '../types.js';
/**
 * Priority 10 — Injects role framing into system prompt.
 * Sources: RoleTemplate.systemPromptAppend + position context + todo items.
 */
export declare class RoleFramingStrategy implements AttentionStrategy {
    name: string;
    priority: number;
    enhance(input: AttentionInput): Promise<AttentionOutput>;
}
//# sourceMappingURL=role-framing.d.ts.map