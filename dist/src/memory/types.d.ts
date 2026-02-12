export type MemoryLayer = 'episode' | 'trace' | 'category' | 'insight';
export declare const LAYER_PREFIXES: Record<MemoryLayer, string>;
export declare const PREFIX_TO_LAYER: Record<string, MemoryLayer>;
export interface MemoryMetadata {
    positionId: string;
    taskId?: string;
    model?: string;
    costUsd?: number;
    consolidatedFrom?: MemoryLayer;
    sourceCount?: number;
    [key: string]: unknown;
}
export interface MemoryEntry {
    id: string;
    layer: MemoryLayer;
    content: string;
    summary: string;
    keywords: string[];
    refs: string[];
    sourceEntries?: string[];
    metadata: MemoryMetadata;
    createdAt: number;
    updatedAt: number;
}
export interface SearchOptions {
    layer?: MemoryLayer;
    limit?: number;
    minRelevance?: number;
}
export interface ListOptions {
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'updatedAt';
    order?: 'asc' | 'desc';
}
export interface MemoryStats {
    totalEntries: number;
    byLayer: Record<MemoryLayer, number>;
    lastUpdated: number;
    indexSize: number;
}
export interface MemoryStore {
    write(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry>;
    read(id: string): Promise<MemoryEntry | null>;
    update(id: string, patch: Partial<Pick<MemoryEntry, 'content' | 'summary' | 'keywords' | 'refs' | 'metadata'>>): Promise<MemoryEntry>;
    delete(id: string): Promise<void>;
    search(query: string, options?: SearchOptions): Promise<MemoryEntry[]>;
    searchByKeywords(keywords: string[], options?: SearchOptions): Promise<MemoryEntry[]>;
    listByLayer(layer: MemoryLayer, options?: ListOptions): Promise<MemoryEntry[]>;
    getConsolidationCandidates(layer: MemoryLayer): Promise<MemoryEntry[]>;
    consolidate(sourceIds: string[], targetLayer: MemoryLayer, consolidated: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry>;
    rewrite(id: string, newContent: string, newSummary: string, newKeywords: string[]): Promise<MemoryEntry>;
    getStats(): Promise<MemoryStats>;
}
export interface InvertedIndex {
    version: number;
    keywords: Record<string, string[]>;
    entries: Record<string, string[]>;
    updatedAt: number;
}
export interface ConsolidationConfig {
    episodeThreshold: number;
    traceThreshold: number;
    categoryThreshold: number;
    model: 'haiku';
    preserveOriginals: boolean;
}
export declare const DEFAULT_CONSOLIDATION_CONFIG: ConsolidationConfig;
/** Create a fresh empty MemoryStats structure. */
export declare function createEmptyMeta(): MemoryStats;
export interface MemoryStoreFactory {
    getStore(positionId: string): MemoryStore;
    getGlobalStore(): MemoryStore;
    searchAcross(query: string, positionIds?: string[]): Promise<CrossSearchResult[]>;
    link(fromId: string, toId: string, relation: string): Promise<void>;
}
export interface CrossSearchResult {
    entry: MemoryEntry;
    storeId: string;
    relevance: number;
}
export interface LinkEntry {
    fromId: string;
    toId: string;
    relation: string;
    createdAt: number;
}
//# sourceMappingURL=types.d.ts.map