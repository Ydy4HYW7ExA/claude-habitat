import { LAYER_PREFIXES as LP, PREFIX_TO_LAYER, createEmptyMeta } from './types.js';
import { IndexEngine } from './index-engine.js';
import { MemoryConsolidator } from './consolidator.js';
import { nanoid } from 'nanoid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { META_FILE, ENTRIES_SUBDIR, NANOID_LENGTH_MEMORY, DEFAULT_SEARCH_LIMIT, DEFAULT_LIST_LIMIT } from '../constants.js';
export class FileMemoryStore {
    baseDir;
    positionId;
    static VALID_ID = /^[etci]-[A-Za-z0-9_-]{8,24}$/;
    entriesDir;
    metaPath;
    indexEngine;
    consolidator;
    consolidating = false;
    constructor(baseDir, positionId, consolidator) {
        this.baseDir = baseDir;
        this.positionId = positionId;
        this.entriesDir = path.join(baseDir, ENTRIES_SUBDIR);
        this.metaPath = path.join(baseDir, META_FILE);
        this.indexEngine = new IndexEngine(baseDir);
        this.consolidator = consolidator ?? new MemoryConsolidator();
    }
    entryPath(id) {
        if (!FileMemoryStore.VALID_ID.test(id)) {
            throw new Error(`Invalid memory entry ID: ${id}`);
        }
        return path.join(this.entriesDir, `${id}.json`);
    }
    generateId(layer) {
        return `${LP[layer]}-${nanoid(NANOID_LENGTH_MEMORY)}`;
    }
    async write(entry) {
        const now = Date.now();
        const full = {
            ...entry,
            id: this.generateId(entry.layer),
            createdAt: now,
            updatedAt: now,
        };
        await fs.mkdir(this.entriesDir, { recursive: true });
        await fs.writeFile(this.entryPath(full.id), JSON.stringify(full, null, 2));
        await this.indexEngine.addEntry(full.id, full.keywords);
        await this.incrementMeta(entry.layer, 1);
        // Trigger consolidation check (non-blocking, prevents re-entrancy)
        this.maybeConsolidate(entry.layer);
        return full;
    }
    async read(id) {
        const filePath = this.entryPath(id); // validation errors throw here
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(data);
        }
        catch (err) {
            if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
                return null;
            }
            throw err;
        }
    }
    async update(id, patch) {
        const entry = await this.read(id);
        if (!entry)
            throw new Error(`Memory entry not found: ${id}`);
        const updated = {
            ...entry,
            ...patch,
            metadata: patch.metadata ? { ...entry.metadata, ...patch.metadata } : entry.metadata,
            updatedAt: Date.now(),
        };
        await fs.writeFile(this.entryPath(id), JSON.stringify(updated, null, 2));
        if (patch.keywords) {
            await this.indexEngine.addEntry(id, updated.keywords);
        }
        this.maybeConsolidate(updated.layer);
        return updated;
    }
    async delete(id) {
        // Determine layer from id prefix for meta update
        const prefix = id.split('-')[0];
        const layer = PREFIX_TO_LAYER[prefix];
        await this.indexEngine.removeEntry(id);
        try {
            await fs.unlink(this.entryPath(id));
        }
        catch (err) {
            if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
                // ignore if not found
            }
            else {
                throw err;
            }
        }
        if (layer) {
            await this.incrementMeta(layer, -1);
        }
    }
    async search(query, options) {
        const keywords = IndexEngine.tokenize(query);
        return this.searchByKeywords(keywords, options);
    }
    async searchByKeywords(keywords, options) {
        const limit = options?.limit ?? DEFAULT_SEARCH_LIMIT;
        const results = await this.indexEngine.search(keywords);
        const entries = [];
        for (const { entryId } of results) {
            if (entries.length >= limit)
                break;
            let entry;
            try {
                entry = await this.read(entryId);
            }
            catch {
                continue; // skip corrupted entries
            }
            if (!entry)
                continue;
            if (options?.layer && entry.layer !== options.layer)
                continue;
            entries.push(entry);
        }
        return entries;
    }
    async listByLayer(layer, options) {
        const prefix = LP[layer];
        const limit = options?.limit ?? DEFAULT_LIST_LIMIT;
        const offset = options?.offset ?? 0;
        const sortBy = options?.sortBy ?? 'createdAt';
        const order = options?.order ?? 'desc';
        let files;
        try {
            files = await fs.readdir(this.entriesDir);
        }
        catch {
            return [];
        }
        const matching = files.filter(f => f.startsWith(`${prefix}-`) && f.endsWith('.json'));
        const entries = [];
        for (const file of matching) {
            try {
                const entry = await this.read(path.basename(file, '.json'));
                if (entry)
                    entries.push(entry);
            }
            catch {
                continue; // skip corrupted entries
            }
        }
        entries.sort((a, b) => {
            const diff = a[sortBy] - b[sortBy];
            return order === 'desc' ? -diff : diff;
        });
        return entries.slice(offset, offset + limit);
    }
    async getConsolidationCandidates(layer) {
        return this.listByLayer(layer, { sortBy: 'createdAt', order: 'asc' });
    }
    async consolidate(sourceIds, targetLayer, consolidated) {
        const entry = await this.write({
            ...consolidated,
            layer: targetLayer,
            sourceEntries: sourceIds,
        });
        return entry;
    }
    async rewrite(id, newContent, newSummary, newKeywords) {
        return this.update(id, {
            content: newContent,
            summary: newSummary,
            keywords: newKeywords,
        });
    }
    async getStats() {
        return this.loadMeta();
    }
    async incrementMeta(layer, delta) {
        const meta = await this.loadMeta();
        meta.byLayer[layer] = Math.max(0, (meta.byLayer[layer] ?? 0) + delta);
        meta.totalEntries = Math.max(0, meta.totalEntries + delta);
        meta.lastUpdated = Date.now();
        meta.indexSize = await this.indexEngine.getSize();
        await fs.mkdir(path.dirname(this.metaPath), { recursive: true });
        await fs.writeFile(this.metaPath, JSON.stringify(meta, null, 2));
    }
    async loadMeta() {
        try {
            const data = await fs.readFile(this.metaPath, 'utf-8');
            return JSON.parse(data);
        }
        catch {
            return createEmptyMeta();
        }
    }
    maybeConsolidate(layer) {
        if (this.consolidating)
            return;
        this.consolidating = true;
        this.consolidator.consolidateSimple(this, layer)
            .catch((err) => { console.error(`[MemoryStore] Consolidation failed for ${layer}:`, err); })
            .finally(() => { this.consolidating = false; });
    }
}
//# sourceMappingURL=store.js.map