// Memory domain types
export const LAYER_PREFIXES = {
    episode: 'e',
    trace: 't',
    category: 'c',
    insight: 'i',
};
export const PREFIX_TO_LAYER = {
    e: 'episode',
    t: 'trace',
    c: 'category',
    i: 'insight',
};
export const DEFAULT_CONSOLIDATION_CONFIG = {
    episodeThreshold: 10,
    traceThreshold: 5,
    categoryThreshold: 3,
    model: 'haiku',
    preserveOriginals: false,
};
/** Create a fresh empty MemoryStats structure. */
export function createEmptyMeta() {
    return {
        totalEntries: 0,
        byLayer: { episode: 0, trace: 0, category: 0, insight: 0 },
        lastUpdated: Date.now(),
        indexSize: 0,
    };
}
//# sourceMappingURL=types.js.map