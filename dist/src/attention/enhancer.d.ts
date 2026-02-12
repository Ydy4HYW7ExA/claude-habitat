import type { AttentionOutput, AttentionStrategy, AttentionContext } from './types.js';
export declare class AttentionEnhancer {
    private strategies;
    register(strategy: AttentionStrategy): void;
    unregister(name: string): void;
    getStrategies(): AttentionStrategy[];
    enhance(prompt: string, context: AttentionContext): Promise<AttentionOutput>;
}
//# sourceMappingURL=enhancer.d.ts.map