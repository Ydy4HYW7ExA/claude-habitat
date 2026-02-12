import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexEngine } from '../../src/memory/index-engine.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { INDEX_VERSION } from '../../src/constants.js';
describe('IndexEngine', () => {
    let tmpDir;
    let engine;
    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'idx-test-'));
        engine = new IndexEngine(tmpDir);
    });
    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
    it('should create empty index on first load', async () => {
        const idx = await engine.load();
        expect(idx.version).toBe(INDEX_VERSION);
        expect(Object.keys(idx.keywords)).toHaveLength(0);
        expect(Object.keys(idx.entries)).toHaveLength(0);
    });
    it('should add entry and update bidirectional mappings', async () => {
        await engine.addEntry('e-001', ['typescript', 'testing']);
        const idx = await engine.load();
        expect(idx.entries['e-001']).toEqual(['typescript', 'testing']);
        expect(idx.keywords['typescript']).toContain('e-001');
        expect(idx.keywords['testing']).toContain('e-001');
    });
    it('should normalize keywords to lowercase', async () => {
        await engine.addEntry('e-001', ['TypeScript', 'TESTING']);
        const idx = await engine.load();
        expect(idx.entries['e-001']).toEqual(['typescript', 'testing']);
        expect(idx.keywords['typescript']).toContain('e-001');
    });
    it('should update entry keywords replacing old ones', async () => {
        await engine.addEntry('e-001', ['old-keyword']);
        await engine.addEntry('e-001', ['new-keyword']);
        const idx = await engine.load();
        expect(idx.entries['e-001']).toEqual(['new-keyword']);
        expect(idx.keywords['old-keyword']).toBeUndefined();
        expect(idx.keywords['new-keyword']).toContain('e-001');
    });
    it('should remove entry and clean up keyword mappings', async () => {
        await engine.addEntry('e-001', ['keyword1', 'keyword2']);
        await engine.addEntry('e-002', ['keyword1']);
        await engine.removeEntry('e-001');
        const idx = await engine.load();
        expect(idx.entries['e-001']).toBeUndefined();
        expect(idx.keywords['keyword1']).toEqual(['e-002']);
        expect(idx.keywords['keyword2']).toBeUndefined();
    });
    it('should search with OR mode (default)', async () => {
        await engine.addEntry('e-001', ['typescript', 'testing']);
        await engine.addEntry('e-002', ['typescript', 'react']);
        await engine.addEntry('e-003', ['python', 'testing']);
        const results = await engine.search(['typescript', 'testing']);
        // e-001 matches both keywords (score 2), others match one (score 1)
        expect(results[0].entryId).toBe('e-001');
        expect(results[0].score).toBe(2);
        expect(results).toHaveLength(3);
    });
    it('should search with AND mode', async () => {
        await engine.addEntry('e-001', ['typescript', 'testing']);
        await engine.addEntry('e-002', ['typescript', 'react']);
        const results = await engine.search(['typescript', 'testing'], 'and');
        expect(results).toHaveLength(1);
        expect(results[0].entryId).toBe('e-001');
    });
    it('should return empty results for no matches', async () => {
        await engine.addEntry('e-001', ['typescript']);
        const results = await engine.search(['python']);
        expect(results).toHaveLength(0);
    });
    it('should persist index to disk and reload', async () => {
        await engine.addEntry('e-001', ['keyword1']);
        // Create new engine instance to force reload from disk
        const engine2 = new IndexEngine(tmpDir);
        const idx = await engine2.load();
        expect(idx.entries['e-001']).toEqual(['keyword1']);
        expect(idx.keywords['keyword1']).toContain('e-001');
    });
    it('should report correct size', async () => {
        await engine.addEntry('e-001', ['a']);
        await engine.addEntry('e-002', ['b']);
        expect(await engine.getSize()).toBe(2);
    });
    it('should tokenize query strings', () => {
        expect(IndexEngine.tokenize('TypeScript testing')).toEqual(['typescript', 'testing']);
        expect(IndexEngine.tokenize('code-review PR')).toEqual(['code-review', 'pr']);
        expect(IndexEngine.tokenize('a')).toEqual([]); // single char filtered
        expect(IndexEngine.tokenize('hello, world!')).toEqual(['hello', 'world']);
    });
    it('should handle invalidate and reload', async () => {
        await engine.addEntry('e-001', ['keyword1']);
        engine.invalidate();
        // After invalidate, next load should read from disk
        const idx = await engine.load();
        expect(idx.entries['e-001']).toEqual(['keyword1']);
    });
});
//# sourceMappingURL=index-engine.test.js.map