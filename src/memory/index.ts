// Memory domain public API
export type {
  MemoryEntry,
  MemoryLayer,
  MemoryMetadata,
  MemoryStore,
  MemoryStats,
  SearchOptions,
  ListOptions,
  InvertedIndex,
  ConsolidationConfig,
  MemoryStoreFactory,
  CrossSearchResult,
  LinkEntry,
} from './types.js';
export { LAYER_PREFIXES, PREFIX_TO_LAYER, DEFAULT_CONSOLIDATION_CONFIG, createEmptyMeta } from './types.js';
export { FileMemoryStore } from './store.js';
export { IndexEngine, createEmptyIndex } from './index-engine.js';
export { MemoryConsolidator } from './consolidator.js';
export { FileMemoryStoreFactory } from './factory.js';
