// Memory domain types

export type MemoryLayer = 'episode' | 'trace' | 'category' | 'insight';

export const LAYER_PREFIXES: Record<MemoryLayer, string> = {
  episode: 'e',
  trace: 't',
  category: 'c',
  insight: 'i',
};

export const PREFIX_TO_LAYER: Record<string, MemoryLayer> = {
  e: 'episode',
  t: 'trace',
  c: 'category',
  i: 'insight',
};

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
  consolidate(
    sourceIds: string[],
    targetLayer: MemoryLayer,
    consolidated: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MemoryEntry>;

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

export const DEFAULT_CONSOLIDATION_CONFIG: ConsolidationConfig = {
  episodeThreshold: 10,
  traceThreshold: 5,
  categoryThreshold: 3,
  model: 'haiku',
  preserveOriginals: false,
};

/** Create a fresh empty MemoryStats structure. */
export function createEmptyMeta(): MemoryStats {
  return {
    totalEntries: 0,
    byLayer: { episode: 0, trace: 0, category: 0, insight: 0 },
    lastUpdated: Date.now(),
    indexSize: 0,
  };
}

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
