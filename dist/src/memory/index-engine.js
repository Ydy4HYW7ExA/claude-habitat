import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { INDEX_FILE, INDEX_VERSION, TOKENIZE_REGEX, MIN_KEYWORD_LENGTH } from '../constants.js';
/** Create a fresh empty inverted index structure. */
export function createEmptyIndex() {
    return { version: INDEX_VERSION, keywords: {}, entries: {}, updatedAt: Date.now() };
}
export class IndexEngine {
    indexPath;
    index = null;
    constructor(baseDir) {
        this.indexPath = path.join(baseDir, INDEX_FILE);
    }
    async load() {
        if (this.index)
            return this.index;
        try {
            const data = await fs.readFile(this.indexPath, 'utf-8');
            this.index = JSON.parse(data);
        }
        catch {
            this.index = createEmptyIndex();
        }
        return this.index;
    }
    async save() {
        if (!this.index)
            return;
        this.index.updatedAt = Date.now();
        await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
        await fs.writeFile(this.indexPath, JSON.stringify(this.index, null, 2));
    }
    async addEntry(entryId, keywords) {
        const idx = await this.load();
        const normalized = keywords.map(k => k.toLowerCase().trim()).filter(Boolean);
        // Remove old mappings if entry already exists
        const oldKeywords = idx.entries[entryId];
        if (oldKeywords) {
            for (const kw of oldKeywords) {
                const list = idx.keywords[kw];
                if (list) {
                    idx.keywords[kw] = list.filter(id => id !== entryId);
                    if (idx.keywords[kw].length === 0)
                        delete idx.keywords[kw];
                }
            }
        }
        // Add new mappings
        idx.entries[entryId] = normalized;
        for (const kw of normalized) {
            if (!idx.keywords[kw])
                idx.keywords[kw] = [];
            if (!idx.keywords[kw].includes(entryId)) {
                idx.keywords[kw].push(entryId);
            }
        }
        await this.save();
    }
    async removeEntry(entryId) {
        const idx = await this.load();
        const keywords = idx.entries[entryId];
        if (!keywords)
            return;
        for (const kw of keywords) {
            const list = idx.keywords[kw];
            if (list) {
                idx.keywords[kw] = list.filter(id => id !== entryId);
                if (idx.keywords[kw].length === 0)
                    delete idx.keywords[kw];
            }
        }
        delete idx.entries[entryId];
        await this.save();
    }
    async search(queryKeywords, mode = 'or') {
        const idx = await this.load();
        const normalized = queryKeywords.map(k => k.toLowerCase().trim()).filter(Boolean);
        if (normalized.length === 0)
            return [];
        const scores = new Map();
        for (const kw of normalized) {
            const entryIds = idx.keywords[kw] || [];
            for (const id of entryIds) {
                scores.set(id, (scores.get(id) || 0) + 1);
            }
        }
        let results = Array.from(scores.entries()).map(([entryId, score]) => ({ entryId, score }));
        if (mode === 'and') {
            results = results.filter(r => r.score >= normalized.length);
        }
        // Sort by score descending
        results.sort((a, b) => b.score - a.score);
        return results;
    }
    async getSize() {
        const idx = await this.load();
        return Object.keys(idx.entries).length;
    }
    /** Tokenize a query string into keywords for search */
    static tokenize(query) {
        return query
            .toLowerCase()
            .replace(TOKENIZE_REGEX, ' ')
            .split(/\s+/)
            .filter(w => w.length >= MIN_KEYWORD_LENGTH);
    }
    /** Invalidate in-memory cache, forcing reload from disk on next access */
    invalidate() {
        this.index = null;
    }
}
//# sourceMappingURL=index-engine.js.map