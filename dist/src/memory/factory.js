import { FileMemoryStore } from './store.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { LINKS_FILE, GLOBAL_MEMORY_ID, RELEVANCE_DECAY_FACTOR, DEFAULT_CROSS_SEARCH_LIMIT } from '../constants.js';
export class FileMemoryStoreFactory {
    baseDir;
    stores = new Map();
    linksPath;
    constructor(baseDir) {
        this.baseDir = baseDir;
        this.linksPath = path.join(baseDir, LINKS_FILE);
    }
    getStore(positionId) {
        if (this.stores.has(positionId))
            return this.stores.get(positionId);
        const storeDir = path.join(this.baseDir, positionId);
        const store = new FileMemoryStore(storeDir, positionId);
        this.stores.set(positionId, store);
        return store;
    }
    getGlobalStore() {
        return this.getStore(GLOBAL_MEMORY_ID);
    }
    async searchAcross(query, positionIds) {
        const ids = positionIds ?? await this.listStoreIds();
        const results = [];
        for (const storeId of ids) {
            const store = this.getStore(storeId);
            const entries = await store.search(query, { limit: DEFAULT_CROSS_SEARCH_LIMIT });
            for (let i = 0; i < entries.length; i++) {
                results.push({
                    entry: entries[i],
                    storeId,
                    relevance: Math.max(0, 1 - (i * RELEVANCE_DECAY_FACTOR)),
                });
            }
        }
        results.sort((a, b) => b.relevance - a.relevance);
        return results;
    }
    async link(fromId, toId, relation) {
        const links = await this.loadLinks();
        links.push({ fromId, toId, relation, createdAt: Date.now() });
        await fs.mkdir(path.dirname(this.linksPath), { recursive: true });
        await fs.writeFile(this.linksPath, JSON.stringify(links, null, 2));
    }
    async getLinks(entryId) {
        const links = await this.loadLinks();
        return links.filter(l => l.fromId === entryId || l.toId === entryId);
    }
    async loadLinks() {
        try {
            const data = await fs.readFile(this.linksPath, 'utf-8');
            return JSON.parse(data);
        }
        catch {
            return [];
        }
    }
    async listStoreIds() {
        try {
            const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
            return entries
                .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== LINKS_FILE)
                .map(d => d.name);
        }
        catch {
            return [];
        }
    }
}
//# sourceMappingURL=factory.js.map