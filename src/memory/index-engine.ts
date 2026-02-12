import type { InvertedIndex } from './types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { INDEX_FILE, INDEX_VERSION, TOKENIZE_REGEX, MIN_KEYWORD_LENGTH } from '../constants.js';

/** Create a fresh empty inverted index structure. */
export function createEmptyIndex(): InvertedIndex {
  return { version: INDEX_VERSION, keywords: {}, entries: {}, updatedAt: Date.now() };
}

export class IndexEngine {
  private indexPath: string;
  private index: InvertedIndex | null = null;

  constructor(baseDir: string) {
    this.indexPath = path.join(baseDir, INDEX_FILE);
  }

  async load(): Promise<InvertedIndex> {
    if (this.index) return this.index;
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      this.index = JSON.parse(data) as InvertedIndex;
    } catch {
      this.index = createEmptyIndex();
    }
    return this.index;
  }

  async save(): Promise<void> {
    if (!this.index) return;
    this.index.updatedAt = Date.now();
    await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
    await fs.writeFile(this.indexPath, JSON.stringify(this.index, null, 2));
  }

  async addEntry(entryId: string, keywords: string[]): Promise<void> {
    const idx = await this.load();
    const normalized = keywords.map(k => k.toLowerCase().trim()).filter(Boolean);

    // Remove old mappings if entry already exists
    const oldKeywords = idx.entries[entryId];
    if (oldKeywords) {
      for (const kw of oldKeywords) {
        const list = idx.keywords[kw];
        if (list) {
          idx.keywords[kw] = list.filter(id => id !== entryId);
          if (idx.keywords[kw].length === 0) delete idx.keywords[kw];
        }
      }
    }

    // Add new mappings
    idx.entries[entryId] = normalized;
    for (const kw of normalized) {
      if (!idx.keywords[kw]) idx.keywords[kw] = [];
      if (!idx.keywords[kw].includes(entryId)) {
        idx.keywords[kw].push(entryId);
      }
    }

    await this.save();
  }

  async removeEntry(entryId: string): Promise<void> {
    const idx = await this.load();
    const keywords = idx.entries[entryId];
    if (!keywords) return;

    for (const kw of keywords) {
      const list = idx.keywords[kw];
      if (list) {
        idx.keywords[kw] = list.filter(id => id !== entryId);
        if (idx.keywords[kw].length === 0) delete idx.keywords[kw];
      }
    }
    delete idx.entries[entryId];

    await this.save();
  }

  async search(queryKeywords: string[], mode: 'and' | 'or' = 'or'): Promise<{ entryId: string; score: number }[]> {
    const idx = await this.load();
    const normalized = queryKeywords.map(k => k.toLowerCase().trim()).filter(Boolean);
    if (normalized.length === 0) return [];

    const scores = new Map<string, number>();

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

  async getSize(): Promise<number> {
    const idx = await this.load();
    return Object.keys(idx.entries).length;
  }

  /** Tokenize a query string into keywords for search */
  static tokenize(query: string): string[] {
    return query
      .toLowerCase()
      .replace(TOKENIZE_REGEX, ' ')
      .split(/\s+/)
      .filter(w => w.length >= MIN_KEYWORD_LENGTH);
  }

  /** Invalidate in-memory cache, forcing reload from disk on next access */
  invalidate(): void {
    this.index = null;
  }
}
