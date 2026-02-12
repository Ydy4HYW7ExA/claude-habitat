import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileProcessStore, FileProgramStore } from '../../src/position/store.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { POSITION_STATUS } from '../../src/constants.js';
describe('FileProcessStore', () => {
    let tmpDir;
    let store;
    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pos-test-'));
        store = new FileProcessStore(tmpDir);
    });
    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
    function makeProcess(id) {
        return {
            id,
            programName: 'coder',
            status: POSITION_STATUS.IDLE,
            sessionHistory: [],
            taskQueue: [],
            outputRoutes: [],
            workDir: path.join(tmpDir, 'process', id),
            memoryDir: path.join(tmpDir, 'data', id, 'memory'),
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
    }
    it('should save and load a position', async () => {
        const pos = makeProcess('coder-01');
        await store.save(pos);
        const loaded = await store.load('coder-01');
        expect(loaded).not.toBeNull();
        expect(loaded.id).toBe('coder-01');
        expect(loaded.programName).toBe('coder');
    });
    it('should return null for non-existent position', async () => {
        const result = await store.load('nonexistent');
        expect(result).toBeNull();
    });
    it('should load all positions', async () => {
        await store.save(makeProcess('pos-1'));
        await store.save(makeProcess('pos-2'));
        const all = await store.loadAll();
        expect(all).toHaveLength(2);
        expect(all.map(p => p.id).sort()).toEqual(['pos-1', 'pos-2']);
    });
    it('should delete a position', async () => {
        await store.save(makeProcess('pos-1'));
        await store.delete('pos-1');
        const result = await store.load('pos-1');
        expect(result).toBeNull();
    });
    it('should serialize output routes without functions', async () => {
        const pos = makeProcess('pos-1');
        pos.outputRoutes = [{
                taskType: 'review',
                targetPositionId: 'reviewer-01',
                transform: (r) => r,
                condition: () => true,
            }];
        await store.save(pos);
        const loaded = await store.load('pos-1');
        expect(loaded.outputRoutes[0].taskType).toBe('review');
        expect(loaded.outputRoutes[0].targetPositionId).toBe('reviewer-01');
        // Functions are not serialized
        expect(loaded.outputRoutes[0].transform).toBeUndefined();
        expect(loaded.outputRoutes[0].condition).toBeUndefined();
    });
});
describe('FileProgramStore', () => {
    let tmpDir;
    let store;
    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'role-test-'));
        store = new FileProgramStore(tmpDir);
    });
    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
    function makeTemplate(name) {
        return {
            name,
            description: `${name} role template`,
            workflowPath: `program/app/${name}/workflow.mjs`,
        };
    }
    it('should save and load a template', async () => {
        await store.save(makeTemplate('coder'));
        const loaded = await store.load('coder');
        expect(loaded).not.toBeNull();
        expect(loaded.name).toBe('coder');
        expect(loaded.workflowPath).toBe('program/app/coder/workflow.mjs');
    });
    it('should return null for non-existent template', async () => {
        const result = await store.load('nonexistent');
        expect(result).toBeNull();
    });
    it('should load all templates', async () => {
        await store.save(makeTemplate('coder'));
        await store.save(makeTemplate('reviewer'));
        const all = await store.loadAll();
        expect(all).toHaveLength(2);
    });
    it('should delete a template', async () => {
        await store.save(makeTemplate('coder'));
        await store.delete('coder');
        const result = await store.load('coder');
        expect(result).toBeNull();
    });
});
//# sourceMappingURL=store.test.js.map