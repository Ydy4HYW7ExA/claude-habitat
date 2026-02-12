import type { InvertedIndex } from './types.js';
/** Create a fresh empty inverted index structure. */
export declare function createEmptyIndex(): InvertedIndex;
export declare class IndexEngine {
    private indexPath;
    private index;
    constructor(baseDir: string);
    load(): Promise<InvertedIndex>;
    save(): Promise<void>;
    addEntry(entryId: string, keywords: string[]): Promise<void>;
    removeEntry(entryId: string): Promise<void>;
    search(queryKeywords: string[], mode?: 'and' | 'or'): Promise<{
        entryId: string;
        score: number;
    }[]>;
    getSize(): Promise<number>;
    /** Tokenize a query string into keywords for search */
    static tokenize(query: string): string[];
    /** Invalidate in-memory cache, forcing reload from disk on next access */
    invalidate(): void;
}
//# sourceMappingURL=index-engine.d.ts.map