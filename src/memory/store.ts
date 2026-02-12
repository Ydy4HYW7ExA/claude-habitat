import type {
  MemoryEntry,
  MemoryLayer,
  MemoryStats,
  MemoryStore,
  SearchOptions,
  ListOptions,
} from './types.js';
import { LAYER_PREFIXES as LP, PREFIX_TO_LAYER, createEmptyMeta } from './types.js';
import { IndexEngine } from './index-engine.js';
import { MemoryConsolidator } from './consolidator.js';
import { nanoid } from 'nanoid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { META_FILE, ENTRIES_SUBDIR, NANOID_LENGTH_MEMORY, DEFAULT_SEARCH_LIMIT, DEFAULT_LIST_LIMIT } from '../constants.js';

export class FileMemoryStore implements MemoryStore {
  private static readonly VALID_ID = /^[etci]-[A-Za-z0-9_-]{8,24}$/;

  private entriesDir: string;
  private metaPath: string;
  private indexEngine: IndexEngine;
  private consolidator: MemoryConsolidator;
  private consolidating = false;

  constructor(
    private baseDir: string,
    private positionId: string,
    consolidator?: MemoryConsolidator,
  ) {
    this.entriesDir = path.join(baseDir, ENTRIES_SUBDIR);
    this.metaPath = path.join(baseDir, META_FILE);
    this.indexEngine = new IndexEngine(baseDir);
    this.consolidator = consolidator ?? new MemoryConsolidator();
  }

  private entryPath(id: string): string {
    if (!FileMemoryStore.VALID_ID.test(id)) {
      throw new Error(`Invalid memory entry ID: ${id}`);
    }
    return path.join(this.entriesDir, `${id}.json`);
  }

  private generateId(layer: MemoryLayer): string {
    return `${LP[layer]}-${nanoid(NANOID_LENGTH_MEMORY)}`;
  }

  async write(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry> {
    const now = Date.now();
    const full: MemoryEntry = {
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

  async read(id: string): Promise<MemoryEntry | null> {
    const filePath = this.entryPath(id); // validation errors throw here
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as MemoryEntry;
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async update(
    id: string,
    patch: Partial<Pick<MemoryEntry, 'content' | 'summary' | 'keywords' | 'refs' | 'metadata'>>,
  ): Promise<MemoryEntry> {
    const entry = await this.read(id);
    if (!entry) throw new Error(`Memory entry not found: ${id}`);

    const updated: MemoryEntry = {
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

  async delete(id: string): Promise<void> {
    // Determine layer from id prefix for meta update
    const prefix = id.split('-')[0];
    const layer = PREFIX_TO_LAYER[prefix];

    await this.indexEngine.removeEntry(id);
    try {
      await fs.unlink(this.entryPath(id));
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        // ignore if not found
      } else {
        throw err;
      }
    }
    if (layer) {
      await this.incrementMeta(layer, -1);
    }
  }

  async search(query: string, options?: SearchOptions): Promise<MemoryEntry[]> {
    const keywords = IndexEngine.tokenize(query);
    return this.searchByKeywords(keywords, options);
  }

  async searchByKeywords(keywords: string[], options?: SearchOptions): Promise<MemoryEntry[]> {
    const limit = options?.limit ?? DEFAULT_SEARCH_LIMIT;
    const results = await this.indexEngine.search(keywords);

    const entries: MemoryEntry[] = [];
    for (const { entryId } of results) {
      if (entries.length >= limit) break;
      let entry: MemoryEntry | null;
      try {
        entry = await this.read(entryId);
      } catch {
        continue; // skip corrupted entries
      }
      if (!entry) continue;
      if (options?.layer && entry.layer !== options.layer) continue;
      entries.push(entry);
    }

    return entries;
  }

  async listByLayer(layer: MemoryLayer, options?: ListOptions): Promise<MemoryEntry[]> {
    const prefix = LP[layer];
    const limit = options?.limit ?? DEFAULT_LIST_LIMIT;
    const offset = options?.offset ?? 0;
    const sortBy = options?.sortBy ?? 'createdAt';
    const order = options?.order ?? 'desc';

    let files: string[];
    try {
      files = await fs.readdir(this.entriesDir);
    } catch {
      return [];
    }

    const matching = files.filter(f => f.startsWith(`${prefix}-`) && f.endsWith('.json'));
    const entries: MemoryEntry[] = [];

    for (const file of matching) {
      try {
        const entry = await this.read(path.basename(file, '.json'));
        if (entry) entries.push(entry);
      } catch {
        continue; // skip corrupted entries
      }
    }

    entries.sort((a, b) => {
      const diff = a[sortBy] - b[sortBy];
      return order === 'desc' ? -diff : diff;
    });

    return entries.slice(offset, offset + limit);
  }

  async getConsolidationCandidates(layer: MemoryLayer): Promise<MemoryEntry[]> {
    return this.listByLayer(layer, { sortBy: 'createdAt', order: 'asc' });
  }

  async consolidate(
    sourceIds: string[],
    targetLayer: MemoryLayer,
    consolidated: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MemoryEntry> {
    const entry = await this.write({
      ...consolidated,
      layer: targetLayer,
      sourceEntries: sourceIds,
    });

    return entry;
  }

  async rewrite(id: string, newContent: string, newSummary: string, newKeywords: string[]): Promise<MemoryEntry> {
    return this.update(id, {
      content: newContent,
      summary: newSummary,
      keywords: newKeywords,
    });
  }

  async getStats(): Promise<MemoryStats> {
    return this.loadMeta();
  }

  private async incrementMeta(layer: MemoryLayer, delta: number): Promise<void> {
    const meta = await this.loadMeta();
    meta.byLayer[layer] = Math.max(0, (meta.byLayer[layer] ?? 0) + delta);
    meta.totalEntries = Math.max(0, meta.totalEntries + delta);
    meta.lastUpdated = Date.now();
    meta.indexSize = await this.indexEngine.getSize();
    await fs.mkdir(path.dirname(this.metaPath), { recursive: true });
    await fs.writeFile(this.metaPath, JSON.stringify(meta, null, 2));
  }

  private async loadMeta(): Promise<MemoryStats> {
    try {
      const data = await fs.readFile(this.metaPath, 'utf-8');
      return JSON.parse(data) as MemoryStats;
    } catch {
      return createEmptyMeta();
    }
  }

  private maybeConsolidate(layer: MemoryLayer): void {
    if (this.consolidating) return;
    this.consolidating = true;
    this.consolidator.consolidateSimple(this, layer)
      .catch((err) => { console.error(`[MemoryStore] Consolidation failed for ${layer}:`, err); })
      .finally(() => { this.consolidating = false; });
  }
}
