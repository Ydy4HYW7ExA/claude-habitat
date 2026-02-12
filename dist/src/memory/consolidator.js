import { DEFAULT_CONSOLIDATION_CONFIG as DEFAULTS } from './types.js';
import { MEMORY_LAYER, PROMPT } from '../constants.js';
const NEXT_LAYER = {
    episode: 'trace',
    trace: 'category',
    category: 'insight',
    insight: null,
};
const LAYER_THRESHOLDS = {
    episode: 'episodeThreshold',
    trace: 'traceThreshold',
    category: 'categoryThreshold',
};
export class MemoryConsolidator {
    config;
    constructor(config = DEFAULTS) {
        this.config = config;
    }
    /**
     * Check if a layer needs consolidation based on entry count.
     */
    needsConsolidation(layer, entryCount) {
        if (layer === MEMORY_LAYER.INSIGHT)
            return false;
        const thresholdKey = LAYER_THRESHOLDS[layer];
        if (!thresholdKey)
            return false;
        const threshold = this.config[thresholdKey];
        return entryCount >= threshold;
    }
    /**
     * Get the target layer for consolidation.
     */
    getTargetLayer(sourceLayer) {
        return NEXT_LAYER[sourceLayer];
    }
    /**
     * Build a consolidation prompt for AI to merge entries.
     * Returns the prompt string to be sent to an AI model.
     */
    buildConsolidationPrompt(entries, targetLayer) {
        const entrySummaries = entries.map((e, i) => `[${i + 1}] (${e.id}) ${e.summary}\n内容: ${e.content}\n关键词: ${e.keywords.join(', ')}`).join('\n\n');
        const layerDesc = PROMPT.CONSOLIDATION_LAYER_DESCRIPTIONS[targetLayer] ?? targetLayer;
        return PROMPT.CONSOLIDATION_PROMPT(entries.length, layerDesc, entrySummaries);
    }
    /**
     * Execute consolidation on a store. This is the "dumb" version that
     * doesn't call AI — it merges content mechanically. For AI-powered
     * consolidation, use the workflow engine.
     */
    async consolidateSimple(store, sourceLayer) {
        const targetLayer = this.getTargetLayer(sourceLayer);
        if (!targetLayer)
            return null;
        const candidates = await store.getConsolidationCandidates(sourceLayer);
        const thresholdKey = LAYER_THRESHOLDS[sourceLayer];
        if (!thresholdKey)
            return null;
        const threshold = this.config[thresholdKey];
        if (candidates.length < threshold)
            return null;
        // Take the oldest entries up to threshold count
        const toConsolidate = candidates.slice(0, threshold);
        const sourceIds = toConsolidate.map(e => e.id);
        // Mechanical merge: concatenate content, union keywords
        const mergedContent = toConsolidate.map(e => `[${e.id}] ${e.content}`).join('\n\n');
        const mergedSummary = `Consolidated ${toConsolidate.length} ${sourceLayer}s: ${toConsolidate.map(e => e.summary).join('; ')}`;
        const mergedKeywords = [...new Set(toConsolidate.flatMap(e => e.keywords))];
        const mergedRefs = [...new Set(toConsolidate.flatMap(e => e.refs))];
        const consolidated = await store.consolidate(sourceIds, targetLayer, {
            layer: targetLayer,
            content: mergedContent,
            summary: mergedSummary,
            keywords: mergedKeywords,
            refs: mergedRefs,
            sourceEntries: sourceIds,
            metadata: {
                positionId: toConsolidate[0].metadata.positionId,
                consolidatedFrom: sourceLayer,
                sourceCount: toConsolidate.length,
            },
        });
        const removedIds = [];
        if (!this.config.preserveOriginals) {
            for (const id of sourceIds) {
                await store.delete(id);
                removedIds.push(id);
            }
        }
        return { consolidated, sourceIds, removedIds };
    }
}
//# sourceMappingURL=consolidator.js.map