import type { MemoryStore, MemoryStoreFactory, CrossSearchResult, LinkEntry } from './types.js';
import { FileMemoryStore } from './store.js';
import { IndexEngine } from './index-engine.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { LINKS_FILE, SHARED_DATA_ID, RELEVANCE_DECAY_FACTOR, DEFAULT_CROSS_SEARCH_LIMIT } from '../constants.js';

export class FileMemoryStoreFactory implements MemoryStoreFactory {
  private stores = new Map<string, FileMemoryStore>();
  private linksPath: string;

  constructor(private baseDir: string) {
    this.linksPath = path.join(baseDir, SHARED_DATA_ID, LINKS_FILE);
  }

  getStore(positionId: string): FileMemoryStore {
    if (this.stores.has(positionId)) return this.stores.get(positionId)!;
    const storeDir = path.join(this.baseDir, positionId, 'memory');
    const store = new FileMemoryStore(storeDir, positionId);
    this.stores.set(positionId, store);
    return store;
  }

  getGlobalStore(): FileMemoryStore {
    if (this.stores.has(SHARED_DATA_ID)) return this.stores.get(SHARED_DATA_ID)!;
    const storeDir = path.join(this.baseDir, SHARED_DATA_ID, 'memory');
    const store = new FileMemoryStore(storeDir, SHARED_DATA_ID);
    this.stores.set(SHARED_DATA_ID, store);
    return store;
  }

  async searchAcross(query: string, positionIds?: string[]): Promise<CrossSearchResult[]> {
    const ids = positionIds ?? await this.listStoreIds();
    const results: CrossSearchResult[] = [];

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

  async link(fromId: string, toId: string, relation: string): Promise<void> {
    const links = await this.loadLinks();
    links.push({ fromId, toId, relation, createdAt: Date.now() });
    await fs.mkdir(path.dirname(this.linksPath), { recursive: true });
    await fs.writeFile(this.linksPath, JSON.stringify(links, null, 2));
  }

  async getLinks(entryId: string): Promise<LinkEntry[]> {
    const links = await this.loadLinks();
    return links.filter(l => l.fromId === entryId || l.toId === entryId);
  }

  private async loadLinks(): Promise<LinkEntry[]> {
    try {
      const data = await fs.readFile(this.linksPath, 'utf-8');
      return JSON.parse(data) as LinkEntry[];
    } catch {
      return [];
    }
  }

  private async listStoreIds(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      return entries
        .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== SHARED_DATA_ID)
        .map(d => d.name);
    } catch {
      return [];
    }
  }
}
