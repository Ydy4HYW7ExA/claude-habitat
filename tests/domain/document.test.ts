import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocumentService } from '../../src/domain/document/service.js';
import { JsonStore } from '../../src/infra/json-store.js';
import { Logger } from '../../src/logging/logger.js';
import type { Document } from '../../src/domain/document/types.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('DocumentService', () => {
  let dir: string;
  let service: DocumentService;

  beforeEach(async () => {
    dir = join(tmpdir(), `doc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(dir, { recursive: true });
    const store = new JsonStore<Document>(dir);
    await store.ensureDir();
    const logger = new Logger({ level: 'error' });
    service = new DocumentService(store, logger);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  describe('ensureLoaded', () => {
    it('loads pre-existing docs from store on first access', async () => {
      // Pre-populate the store with a doc before the service loads
      const store = new JsonStore<Document>(dir);
      const preDoc: Document = {
        id: 'doc-pre', name: 'Pre', summary: 'pre', content: '',
        tags: ['a', 'b'], keywords: ['pre'], createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z', refs: [], refsBy: [],
      };
      await store.save(preDoc.id, preDoc);

      const freshService = new DocumentService(store, new Logger({ level: 'error' }));
      const result = await freshService.read('doc-pre', 'full');
      expect((result as Document).name).toBe('Pre');
    });
  });

  describe('create', () => {
    it('creates a document with required fields', async () => {
      const doc = await service.create({
        name: 'Test Doc',
        summary: 'A test document',
        tags: ['test', 'example'],
      });
      expect(doc.id).toMatch(/^doc-/);
      expect(doc.name).toBe('Test Doc');
      expect(doc.tags).toEqual(['test', 'example']);
      expect(doc.refs).toEqual([]);
      expect(doc.refsBy).toEqual([]);
    });

    it('auto-extracts keywords from content', async () => {
      const doc = await service.create({
        name: 'Keywords Test',
        summary: 'Testing keyword extraction',
        content: 'The quick brown fox jumps over the lazy dog repeatedly',
        tags: ['test', 'keywords'],
      });
      expect(doc.keywords.length).toBeGreaterThan(0);
    });

    it('extracts empty keywords from content with no words', async () => {
      const doc = await service.create({
        name: 'No Words',
        summary: 'no words content',
        content: '12 34 56',
        tags: ['test', 'keywords'],
      });
      expect(doc.keywords).toEqual([]);
    });

    it('uses default maxKeywords when config is undefined', async () => {
      // Create a service without config
      const store2 = new JsonStore<Document>(dir);
      const noConfigService = new DocumentService(store2, new Logger({ level: 'error' }));
      const doc = await noConfigService.create({
        name: 'Default KW',
        summary: 'default keywords',
        content: 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22',
        tags: ['test', 'keywords'],
      });
      expect(doc.keywords.length).toBeLessThanOrEqual(50);
    });

    it('uses provided keywords', async () => {
      const doc = await service.create({
        name: 'Custom KW',
        summary: 'Custom keywords',
        tags: ['test', 'custom'],
        keywords: ['alpha', 'beta'],
      });
      expect(doc.keywords).toEqual(['alpha', 'beta']);
    });

    it('rejects invalid input', async () => {
      await expect(
        service.create({ name: '', summary: 'x', tags: ['a'] }),
      ).rejects.toThrow();
    });
  });

  describe('read', () => {
    it('reads summary view', async () => {
      const doc = await service.create({
        name: 'Read Test',
        summary: 'For reading',
        tags: ['test', 'read'],
      });
      const meta = await service.read(doc.id, 'summary');
      expect(meta).toBeDefined();
      expect(meta).not.toHaveProperty('content');
    });

    it('reads full view', async () => {
      const doc = await service.create({
        name: 'Read Full',
        summary: 'Full read',
        content: 'Full content here',
        tags: ['test', 'read'],
      });
      const full = await service.read(doc.id, 'full');
      expect(full).toHaveProperty('content', 'Full content here');
    });

    it('throws for missing doc', async () => {
      await expect(service.read('doc-nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('update', () => {
    it('updates name and summary', async () => {
      const doc = await service.create({
        name: 'Original',
        summary: 'Original summary',
        tags: ['test', 'update'],
      });
      const updated = await service.update(doc.id, {
        name: 'Updated',
        summary: 'Updated summary',
      });
      expect(updated.name).toBe('Updated');
      expect(updated.summary).toBe('Updated summary');
    });

    it('throws for missing doc', async () => {
      await expect(
        service.update('doc-missing', { name: 'x' }),
      ).rejects.toThrow('not found');
    });

    it('throws when updating refs to nonexistent doc', async () => {
      const a = await service.create({ name: 'A', summary: 'a', tags: ['test', 'upd'] });
      await expect(
        service.update(a.id, { refs: ['doc-fake'] }),
      ).rejects.toThrow('not found');
    });

    it('rejects invalid update input', async () => {
      const doc = await service.create({ name: 'V', summary: 'v', tags: ['test', 'val'] });
      await expect(
        service.update(doc.id, { name: '' }),
      ).rejects.toThrow();
    });

    it('updates content, tags, and keywords', async () => {
      const doc = await service.create({
        name: 'Fields', summary: 'fields test', tags: ['test', 'fields'],
      });
      const updated = await service.update(doc.id, {
        content: 'new content',
        tags: ['updated', 'fields'],
        keywords: ['kw1'],
      });
      expect(updated.content).toBe('new content');
      expect(updated.tags).toEqual(['updated', 'fields']);
      expect(updated.keywords).toEqual(['kw1']);
    });

    it('updates refs and manages bidirectional links', async () => {
      const a = await service.create({ name: 'A', summary: 'a', tags: ['test', 'upd'] });
      const b = await service.create({ name: 'B', summary: 'b', tags: ['test', 'upd'] });
      const c = await service.create({
        name: 'C', summary: 'c', tags: ['test', 'upd'], refs: [a.id],
      });
      // Update C: remove ref to A, add ref to B
      await service.update(c.id, { refs: [b.id] });
      const aRead = (await service.read(a.id, 'full')) as Document;
      const bRead = (await service.read(b.id, 'full')) as Document;
      expect(aRead.refsBy).not.toContain(c.id);
      expect(bRead.refsBy).toContain(c.id);
    });
  });

  describe('delete', () => {
    it('deletes a document', async () => {
      const doc = await service.create({
        name: 'To Delete',
        summary: 'Will be deleted',
        tags: ['test', 'delete'],
      });
      await service.delete(doc.id);
      await expect(service.read(doc.id)).rejects.toThrow('not found');
    });

    it('throws for missing doc', async () => {
      await expect(service.delete('doc-nope')).rejects.toThrow('not found');
    });
  });

  describe('list', () => {
    it('lists all documents', async () => {
      await service.create({ name: 'A', summary: 'a', tags: ['test', 'list'] });
      await service.create({ name: 'B', summary: 'b', tags: ['test', 'list'] });
      const result = await service.list();
      expect(result.documents).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters by tags', async () => {
      await service.create({ name: 'A', summary: 'a', tags: ['alpha', 'common'] });
      await service.create({ name: 'B', summary: 'b', tags: ['beta', 'common'] });
      const result = await service.list({ tags: ['alpha'] });
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].name).toBe('A');
    });

    it('filters by keyword', async () => {
      await service.create({
        name: 'Alpha Doc', summary: 'about alpha', tags: ['test', 'kw'],
        content: 'alpha alpha alpha content here',
      });
      await service.create({
        name: 'Beta Doc', summary: 'about beta', tags: ['test', 'kw'],
        content: 'beta beta beta content here',
      });
      const result = await service.list({ keyword: 'alpha' });
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].name).toBe('Alpha Doc');
    });

    it('filters by keyword combined with tags', async () => {
      await service.create({
        name: 'Match', summary: 'match summary', tags: ['target', 'combo'],
        content: 'special special special word',
      });
      await service.create({
        name: 'NoTag', summary: 'no tag match', tags: ['other', 'combo'],
        content: 'special special special word',
      });
      const result = await service.list({ tags: ['target'], keyword: 'special' });
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].name).toBe('Match');
    });

    it('filters by keyword combined with tags excluding non-matches', async () => {
      await service.create({
        name: 'Match', summary: 'match summary', tags: ['target', 'combo'],
        content: 'special special special word',
      });
      await service.create({
        name: 'TagOnly', summary: 'no keyword match', tags: ['target', 'combo'],
        content: 'nothing relevant here at all',
      });
      const result = await service.list({ tags: ['target'], keyword: 'special' });
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].name).toBe('Match');
    });

    it('paginates results', async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({ name: `Doc ${i}`, summary: `s${i}`, tags: ['test', 'page'] });
      }
      const result = await service.list({ limit: 2, offset: 1 });
      expect(result.documents).toHaveLength(2);
      expect(result.total).toBe(5);
    });
  });

  describe('references', () => {
    it('creates bidirectional refs', async () => {
      const a = await service.create({ name: 'A', summary: 'a', tags: ['test', 'ref'] });
      const b = await service.create({
        name: 'B', summary: 'b', tags: ['test', 'ref'], refs: [a.id],
      });
      const aRead = (await service.read(a.id, 'full')) as Document;
      expect(aRead.refsBy).toContain(b.id);
      expect(b.refs).toContain(a.id);
    });

    it('cleans up refs on delete', async () => {
      const a = await service.create({ name: 'A', summary: 'a', tags: ['test', 'ref'] });
      const b = await service.create({
        name: 'B', summary: 'b', tags: ['test', 'ref'], refs: [a.id],
      });
      await service.delete(b.id);
      const aRead = (await service.read(a.id, 'full')) as Document;
      expect(aRead.refsBy).not.toContain(b.id);
    });

    it('cleans up refs on referencing docs when deleted', async () => {
      const a = await service.create({ name: 'A', summary: 'a', tags: ['test', 'ref'] });
      const b = await service.create({
        name: 'B', summary: 'b', tags: ['test', 'ref'], refs: [a.id],
      });
      // Delete A, which is referenced by B
      await service.delete(a.id);
      const bRead = (await service.read(b.id, 'full')) as Document;
      expect(bRead.refs).not.toContain(a.id);
    });

    it('does not duplicate refsBy when adding same ref twice', async () => {
      const a = await service.create({ name: 'A', summary: 'a', tags: ['test', 'ref'] });
      const b = await service.create({
        name: 'B', summary: 'b', tags: ['test', 'ref'], refs: [a.id],
      });
      // Update B with same refs again — should not duplicate refsBy on A
      await service.update(b.id, { refs: [a.id] });
      const aRead = (await service.read(a.id, 'full')) as Document;
      const count = aRead.refsBy.filter((r) => r === b.id).length;
      expect(count).toBe(1);
    });

    it('rejects refs to nonexistent docs', async () => {
      await expect(
        service.create({ name: 'X', summary: 'x', tags: ['test', 'ref'], refs: ['doc-fake'] }),
      ).rejects.toThrow('not found');
    });
  });

  describe('graph', () => {
    it('returns graph for a document', async () => {
      const a = await service.create({ name: 'A', summary: 'a', tags: ['test', 'graph'] });
      const b = await service.create({
        name: 'B', summary: 'b', tags: ['test', 'graph'], refs: [a.id],
      });
      const graph = await service.graph(a.id, 1);
      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(1);
    });

    it('includes refs edges in graph traversal', async () => {
      const a = await service.create({ name: 'A', summary: 'a', tags: ['test', 'graph'] });
      const b = await service.create({
        name: 'B', summary: 'b', tags: ['test', 'graph'], refs: [a.id],
      });
      // Graph from B: B has refs=[a.id], so refs edge should appear
      const graph = await service.graph(b.id, 1);
      expect(graph.nodes).toHaveLength(2);
      const refsEdge = graph.edges.find((e) => e.type === 'refs');
      expect(refsEdge).toBeDefined();
      expect(refsEdge!.from).toBe(b.id);
      expect(refsEdge!.to).toBe(a.id);
    });

    it('includes refs and refsBy edges', async () => {
      const a = await service.create({ name: 'A', summary: 'a', tags: ['test', 'edge'] });
      const b = await service.create({
        name: 'B', summary: 'b', tags: ['test', 'edge'], refs: [a.id],
      });
      const graph = await service.graph(a.id, 1);
      const refsEdge = graph.edges.find((e) => e.type === 'refsBy');
      expect(refsEdge).toBeDefined();
      expect(refsEdge!.from).toBe(b.id);
      expect(refsEdge!.to).toBe(a.id);
    });

    it('skips already-visited nodes in BFS', async () => {
      // Create a triangle: A->B, A->C, B->C
      const c = await service.create({ name: 'C', summary: 'c', tags: ['test', 'bfs'] });
      const b = await service.create({ name: 'B', summary: 'b', tags: ['test', 'bfs'], refs: [c.id] });
      const a = await service.create({ name: 'A', summary: 'a', tags: ['test', 'bfs'], refs: [b.id, c.id] });
      // Graph from A at depth 2: C should appear only once
      const graph = await service.graph(a.id, 2);
      const cNodes = graph.nodes.filter((n) => n.document.name === 'C');
      expect(cNodes).toHaveLength(1);
    });

    it('throws for missing doc', async () => {
      await expect(service.graph('doc-missing')).rejects.toThrow('not found');
    });
  });

  describe('getCount', () => {
    it('returns 0 when no documents exist', async () => {
      await service.ensureLoaded();
      expect(service.getCount()).toBe(0);
    });

    it('returns correct count after creating documents', async () => {
      await service.create({ name: 'A', summary: 'a', tags: ['test', 'count'] });
      await service.create({ name: 'B', summary: 'b', tags: ['test', 'count'] });
      expect(service.getCount()).toBe(2);
    });
  });
});
