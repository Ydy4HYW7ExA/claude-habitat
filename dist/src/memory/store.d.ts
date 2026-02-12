import type { MemoryEntry, MemoryLayer, MemoryStats, MemoryStore, SearchOptions, ListOptions } from './types.js';
import { MemoryConsolidator } from './consolidator.js';
export declare class FileMemoryStore implements MemoryStore {
    private baseDir;
    private positionId;
    private static readonly VALID_ID;
    private entriesDir;
    private metaPath;
    private indexEngine;
    private consolidator;
    private consolidating;
    constructor(baseDir: string, positionId: string, consolidator?: MemoryConsolidator);
    private entryPath;
    private generateId;
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
    private incrementMeta;
    private loadMeta;
    private maybeConsolidate;
}
//# sourceMappingURL=store.d.ts.map