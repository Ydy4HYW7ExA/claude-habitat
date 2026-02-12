import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryConsolidator } from '../../src/memory/consolidator.js';
import { FileMemoryStore } from '../../src/memory/store.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { MEMORY_LAYER, MODEL, PROMPT } from '../../src/constants.js';
describe('MemoryConsolidator', () => {
    let tmpDir;
    let store;
    let consolidator;
    const config = {
        episodeThreshold: 3,
        traceThreshold: 2,
        categoryThreshold: 2,
        model: MODEL.HAIKU,
        preserveOriginals: false,
    };
    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cons-test-'));
        store = new FileMemoryStore(tmpDir, 'test-position');
        consolidator = new MemoryConsolidator(config);
    });
    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
    function makeEntry(overrides) {
        return {
            layer: MEMORY_LAYER.EPISODE,
            content: 'Test content',
            summary: 'Test summary',
            keywords: ['test'],
            refs: [],
            metadata: { positionId: 'test-position' },
            ...overrides,
        };
    }
    describe('needsConsolidation', () => {
        it('should return true when threshold is met', () => {
            expect(consolidator.needsConsolidation(MEMORY_LAYER.EPISODE, 3)).toBe(true);
            expect(consolidator.needsConsolidation(MEMORY_LAYER.EPISODE, 5)).toBe(true);
        });
        it('should return false when below threshold', () => {
            expect(consolidator.needsConsolidation(MEMORY_LAYER.EPISODE, 2)).toBe(false);
        });
        it('should never consolidate insights', () => {
            expect(consolidator.needsConsolidation(MEMORY_LAYER.INSIGHT, 100)).toBe(false);
        });
    });
    describe('getTargetLayer', () => {
        it('should return correct next layer', () => {
            expect(consolidator.getTargetLayer(MEMORY_LAYER.EPISODE)).toBe(MEMORY_LAYER.TRACE);
            expect(consolidator.getTargetLayer(MEMORY_LAYER.TRACE)).toBe(MEMORY_LAYER.CATEGORY);
            expect(consolidator.getTargetLayer(MEMORY_LAYER.CATEGORY)).toBe(MEMORY_LAYER.INSIGHT);
            expect(consolidator.getTargetLayer(MEMORY_LAYER.INSIGHT)).toBeNull();
        });
    });
    describe('buildConsolidationPrompt', () => {
        it('should build a prompt with all entries', () => {
            const entries = [
                { ...makeEntry(), id: 'e-001', createdAt: 1, updatedAt: 1 },
                { ...makeEntry({ content: 'Other content' }), id: 'e-002', createdAt: 2, updatedAt: 2 },
            ];
            const prompt = consolidator.buildConsolidationPrompt(entries, MEMORY_LAYER.TRACE);
            expect(prompt).toContain('e-001');
            expect(prompt).toContain('e-002');
            expect(prompt).toContain('Test content');
            expect(prompt).toContain('Other content');
            expect(prompt).toContain(PROMPT.CONSOLIDATION_LAYER_DESCRIPTIONS[MEMORY_LAYER.TRACE]);
        });
    });
    describe('consolidateSimple', () => {
        it('should consolidate episodes into a trace when threshold is met', async () => {
            await store.write(makeEntry({ content: 'Fact 1', keywords: ['a'] }));
            await store.write(makeEntry({ content: 'Fact 2', keywords: ['b'] }));
            await store.write(makeEntry({ content: 'Fact 3', keywords: ['c'] }));
            const result = await consolidator.consolidateSimple(store, MEMORY_LAYER.EPISODE);
            expect(result).not.toBeNull();
            expect(result.consolidated.layer).toBe(MEMORY_LAYER.TRACE);
            expect(result.consolidated.sourceEntries).toHaveLength(3);
            expect(result.consolidated.keywords).toEqual(expect.arrayContaining(['a', 'b', 'c']));
        });
        it('should remove source entries when preserveOriginals is false', async () => {
            const e1 = await store.write(makeEntry({ content: 'Fact 1', keywords: ['a'] }));
            const e2 = await store.write(makeEntry({ content: 'Fact 2', keywords: ['b'] }));
            const e3 = await store.write(makeEntry({ content: 'Fact 3', keywords: ['c'] }));
            const result = await consolidator.consolidateSimple(store, MEMORY_LAYER.EPISODE);
            expect(result.removedIds).toHaveLength(3);
            expect(await store.read(e1.id)).toBeNull();
            expect(await store.read(e2.id)).toBeNull();
            expect(await store.read(e3.id)).toBeNull();
        });
        it('should preserve originals when configured', async () => {
            const preserveConsolidator = new MemoryConsolidator({ ...config, preserveOriginals: true });
            const e1 = await store.write(makeEntry({ content: 'Fact 1', keywords: ['a'] }));
            await store.write(makeEntry({ content: 'Fact 2', keywords: ['b'] }));
            await store.write(makeEntry({ content: 'Fact 3', keywords: ['c'] }));
            const result = await preserveConsolidator.consolidateSimple(store, MEMORY_LAYER.EPISODE);
            expect(result.removedIds).toHaveLength(0);
            expect(await store.read(e1.id)).not.toBeNull();
        });
        it('should return null when below threshold', async () => {
            await store.write(makeEntry());
            const result = await consolidator.consolidateSimple(store, MEMORY_LAYER.EPISODE);
            expect(result).toBeNull();
        });
        it('should return null for insight layer', async () => {
            const result = await consolidator.consolidateSimple(store, MEMORY_LAYER.INSIGHT);
            expect(result).toBeNull();
        });
    });
});
//# sourceMappingURL=consolidator.test.js.map