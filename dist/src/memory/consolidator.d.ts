import type { MemoryEntry, MemoryLayer, ConsolidationConfig } from './types.js';
import type { FileMemoryStore } from './store.js';
export interface ConsolidationResult {
    consolidated: MemoryEntry;
    sourceIds: string[];
    removedIds: string[];
}
export declare class MemoryConsolidator {
    private config;
    constructor(config?: ConsolidationConfig);
    /**
     * Check if a layer needs consolidation based on entry count.
     */
    needsConsolidation(layer: MemoryLayer, entryCount: number): boolean;
    /**
     * Get the target layer for consolidation.
     */
    getTargetLayer(sourceLayer: MemoryLayer): MemoryLayer | null;
    /**
     * Build a consolidation prompt for AI to merge entries.
     * Returns the prompt string to be sent to an AI model.
     */
    buildConsolidationPrompt(entries: MemoryEntry[], targetLayer: MemoryLayer): string;
    /**
     * Execute consolidation on a store. This is the "dumb" version that
     * doesn't call AI — it merges content mechanically. For AI-powered
     * consolidation, use the workflow engine.
     */
    consolidateSimple(store: FileMemoryStore, sourceLayer: MemoryLayer): Promise<ConsolidationResult | null>;
}
//# sourceMappingURL=consolidator.d.ts.map