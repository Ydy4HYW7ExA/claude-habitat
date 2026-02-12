import type { MemoryStoreFactory, CrossSearchResult, LinkEntry } from './types.js';
import { FileMemoryStore } from './store.js';
export declare class FileMemoryStoreFactory implements MemoryStoreFactory {
    private baseDir;
    private stores;
    private linksPath;
    constructor(baseDir: string);
    getStore(positionId: string): FileMemoryStore;
    getGlobalStore(): FileMemoryStore;
    searchAcross(query: string, positionIds?: string[]): Promise<CrossSearchResult[]>;
    link(fromId: string, toId: string, relation: string): Promise<void>;
    getLinks(entryId: string): Promise<LinkEntry[]>;
    private loadLinks;
    private listStoreIds;
}
//# sourceMappingURL=factory.d.ts.map