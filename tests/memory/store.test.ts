import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileMemoryStore } from '../../src/memory/store.js';
import type { MemoryEntry } from '../../src/memory/types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { MEMORY_LAYER, MEMORY_ID_PREFIX } from '../../src/constants.js';

describe('FileMemoryStore', () => {
  let tmpDir: string;
  let store: FileMemoryStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mem-test-'));
    store = new FileMemoryStore(tmpDir, 'test-position');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function makeEntry(overrides?: Partial<Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>>) {
    return {
      layer: MEMORY_LAYER.EPISODE,
      content: 'Test content',
      summary: 'Test summary',
      keywords: ['test', 'memory'],
      refs: [],
      metadata: { positionId: 'test-position' },
      ...overrides,
    };
  }

  describe('write and read', () => {
    it('should write an entry and read it back', async () => {
      const entry = await store.write(makeEntry());

      expect(entry.id).toMatch(new RegExp('^' + MEMORY_ID_PREFIX.EPISODE));
      expect(entry.content).toBe('Test content');
      expect(entry.createdAt).toBeGreaterThan(0);

      const read = await store.read(entry.id);
      expect(read).toEqual(entry);
    });

    it('should generate IDs with correct layer prefix', async () => {
      const episode = await store.write(makeEntry({ layer: MEMORY_LAYER.EPISODE }));
      const trace = await store.write(makeEntry({ layer: MEMORY_LAYER.TRACE }));
      const category = await store.write(makeEntry({ layer: MEMORY_LAYER.CATEGORY }));
      const insight = await store.write(makeEntry({ layer: MEMORY_LAYER.INSIGHT }));

      expect(episode.id).toMatch(new RegExp('^' + MEMORY_ID_PREFIX.EPISODE));
      expect(trace.id).toMatch(new RegExp('^' + MEMORY_ID_PREFIX.TRACE));
      expect(category.id).toMatch(new RegExp('^' + MEMORY_ID_PREFIX.CATEGORY));
      expect(insight.id).toMatch(new RegExp('^' + MEMORY_ID_PREFIX.INSIGHT));
    });

    it('should return null for non-existent entry', async () => {
      const result = await store.read('e-nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update entry fields', async () => {
      const entry = await store.write(makeEntry());
      const updated = await store.update(entry.id, {
        content: 'Updated content',
        keywords: ['updated'],
      });

      expect(updated.content).toBe('Updated content');
      expect(updated.keywords).toEqual(['updated']);
      expect(updated.updatedAt).toBeGreaterThanOrEqual(entry.updatedAt);
    });

    it('should merge metadata', async () => {
      const entry = await store.write(makeEntry({
        metadata: { positionId: 'test', extra: 'value' },
      }));
      const updated = await store.update(entry.id, {
        metadata: { positionId: 'test', newField: 'new' },
      });

      expect(updated.metadata.extra).toBe('value');
      expect(updated.metadata.newField).toBe('new');
    });

    it('should throw for non-existent entry', async () => {
      await expect(store.update('e-nonexistent', { content: 'x' }))
        .rejects.toThrow('Memory entry not found');
    });
  });

  describe('delete', () => {
    it('should delete an entry', async () => {
      const entry = await store.write(makeEntry());
      await store.delete(entry.id);
      const result = await store.read(entry.id);
      expect(result).toBeNull();
    });

    it('should not throw when deleting non-existent entry', async () => {
      await expect(store.delete('e-nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('search', () => {
    it('should find entries by keyword search', async () => {
      await store.write(makeEntry({ keywords: ['typescript', 'testing'], summary: 'TS test' }));
      await store.write(makeEntry({ keywords: ['python', 'testing'], summary: 'Py test' }));
      await store.write(makeEntry({ keywords: ['typescript', 'react'], summary: 'TS react' }));

      const results = await store.search('typescript testing');
      expect(results.length).toBeGreaterThanOrEqual(1);
      // The entry with both keywords should rank first
      expect(results[0].keywords).toContain('typescript');
    });

    it('should filter by layer', async () => {
      await store.write(makeEntry({ layer: MEMORY_LAYER.EPISODE, keywords: ['shared'] }));
      await store.write(makeEntry({ layer: MEMORY_LAYER.TRACE, keywords: ['shared'] }));

      const results = await store.search('shared', { layer: MEMORY_LAYER.EPISODE });
      expect(results.every(e => e.layer === MEMORY_LAYER.EPISODE)).toBe(true);
    });

    it('should respect limit', async () => {
      for (let i = 0; i < 5; i++) {
        await store.write(makeEntry({ keywords: ['common'] }));
      }

      const results = await store.search('common', { limit: 2 });
      expect(results).toHaveLength(2);
    });
  });

  describe('searchByKeywords', () => {
    it('should search by explicit keyword array', async () => {
      await store.write(makeEntry({ keywords: ['alpha', 'beta'] }));
      await store.write(makeEntry({ keywords: ['gamma'] }));

      const results = await store.searchByKeywords(['alpha']);
      expect(results).toHaveLength(1);
      expect(results[0].keywords).toContain('alpha');
    });
  });

  describe('listByLayer', () => {
    it('should list entries of a specific layer', async () => {
      await store.write(makeEntry({ layer: MEMORY_LAYER.EPISODE }));
      await store.write(makeEntry({ layer: MEMORY_LAYER.EPISODE }));
      await store.write(makeEntry({ layer: MEMORY_LAYER.TRACE }));

      const episodes = await store.listByLayer(MEMORY_LAYER.EPISODE);
      expect(episodes).toHaveLength(2);
      expect(episodes.every(e => e.layer === MEMORY_LAYER.EPISODE)).toBe(true);
    });

    it('should support pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await store.write(makeEntry({ content: `Entry ${i}` }));
      }

      const page1 = await store.listByLayer(MEMORY_LAYER.EPISODE, { limit: 2, offset: 0 });
      const page2 = await store.listByLayer(MEMORY_LAYER.EPISODE, { limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe('consolidate', () => {
    it('should create a consolidated entry with source references', async () => {
      const e1 = await store.write(makeEntry({ content: 'Fact 1', keywords: ['a'] }));
      const e2 = await store.write(makeEntry({ content: 'Fact 2', keywords: ['b'] }));

      const consolidated = await store.consolidate(
        [e1.id, e2.id],
        MEMORY_LAYER.TRACE,
        {
          layer: MEMORY_LAYER.TRACE,
          content: 'Combined facts',
          summary: 'Facts 1 and 2',
          keywords: ['a', 'b'],
          refs: [],
          metadata: { positionId: 'test-position' },
        },
      );

      expect(consolidated.id).toMatch(new RegExp('^' + MEMORY_ID_PREFIX.TRACE));
      expect(consolidated.sourceEntries).toEqual([e1.id, e2.id]);
      expect(consolidated.layer).toBe(MEMORY_LAYER.TRACE);
    });
  });

  describe('rewrite', () => {
    it('should rewrite entry content, summary, and keywords', async () => {
      const entry = await store.write(makeEntry());
      const rewritten = await store.rewrite(
        entry.id,
        'Rewritten content',
        'Rewritten summary',
        ['rewritten'],
      );

      expect(rewritten.content).toBe('Rewritten content');
      expect(rewritten.summary).toBe('Rewritten summary');
      expect(rewritten.keywords).toEqual(['rewritten']);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      await store.write(makeEntry({ layer: MEMORY_LAYER.EPISODE }));
      await store.write(makeEntry({ layer: MEMORY_LAYER.EPISODE }));
      await store.write(makeEntry({ layer: MEMORY_LAYER.TRACE }));

      const stats = await store.getStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.byLayer.episode).toBe(2);
      expect(stats.byLayer.trace).toBe(1);
      expect(stats.byLayer.category).toBe(0);
      expect(stats.byLayer.insight).toBe(0);
    });
  });

  describe('path injection protection', () => {
    it('should reject path traversal IDs', async () => {
      await expect(store.read('../etc/passwd')).rejects.toThrow('Invalid memory entry ID');
    });

    it('should reject empty string IDs', async () => {
      await expect(store.read('')).rejects.toThrow('Invalid memory entry ID');
    });

    it('should reject IDs with slashes', async () => {
      await expect(store.read('e-abc/def')).rejects.toThrow('Invalid memory entry ID');
    });

    it('should reject IDs with wrong prefix', async () => {
      await expect(store.read('x-abcdefghijkl')).rejects.toThrow('Invalid memory entry ID');
    });

    it('should accept valid IDs', async () => {
      // Valid format but non-existent — should return null, not throw
      const result = await store.read('e-abcdefghijkl');
      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw on corrupted JSON instead of returning null', async () => {
      // Write a valid entry first to create the directory
      const entry = await store.write(makeEntry());

      // Corrupt the file
      const entryPath = path.join(tmpDir, 'entries', `${entry.id}.json`);
      await fs.writeFile(entryPath, 'not valid json{{{');

      await expect(store.read(entry.id)).rejects.toThrow();
    });

    it('should skip corrupted entries in listByLayer', async () => {
      const good = await store.write(makeEntry({ layer: MEMORY_LAYER.EPISODE }));
      const bad = await store.write(makeEntry({ layer: MEMORY_LAYER.EPISODE }));

      // Corrupt one entry
      const badPath = path.join(tmpDir, 'entries', `${bad.id}.json`);
      await fs.writeFile(badPath, '{invalid json');

      const results = await store.listByLayer(MEMORY_LAYER.EPISODE);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(good.id);
    });

    it('delete should throw on non-ENOENT errors for invalid IDs', async () => {
      await expect(store.delete('../../../etc/passwd')).rejects.toThrow('Invalid memory entry ID');
    });
  });
});
