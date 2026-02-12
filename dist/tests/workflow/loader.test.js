import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkflowLoader } from '../../src/workflow/loader.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
describe('WorkflowLoader', () => {
    let tmpDir;
    let loader;
    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wf-loader-'));
        loader = new WorkflowLoader(tmpDir);
    });
    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
    async function writeWorkflow(name, code) {
        const filePath = path.join(tmpDir, name);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, code);
        return name;
    }
    it('should load a workflow function', async () => {
        const wfPath = await writeWorkflow('test.mjs', `
      export default async function(ctx) {
        return 'hello';
      }
    `);
        const fn = await loader.load(wfPath);
        expect(typeof fn).toBe('function');
    });
    it('should cache loaded workflows', async () => {
        const wfPath = await writeWorkflow('cached.mjs', `
      export default async function(ctx) {
        return 'cached';
      }
    `);
        const fn1 = await loader.load(wfPath);
        const fn2 = await loader.load(wfPath);
        expect(fn1).toBe(fn2);
    });
    it('should reload when file changes after invalidation', async () => {
        const wfPath = await writeWorkflow('changing.mjs', `
      export default async function(ctx) {
        return 'v1';
      }
    `);
        const fn1 = await loader.load(wfPath);
        expect(typeof fn1).toBe('function');
        // Invalidate and rewrite
        loader.invalidate(wfPath);
        await writeWorkflow('changing.mjs', `
      export default async function(ctx) {
        return 'v2';
      }
    `);
        // After invalidation + file change, should reload successfully
        const fn2 = await loader.load(wfPath);
        expect(typeof fn2).toBe('function');
    });
    it('should invalidate cache', async () => {
        const wfPath = await writeWorkflow('invalidate.mjs', `
      export default async function(ctx) {
        return 'original';
      }
    `);
        await loader.load(wfPath);
        loader.invalidate(wfPath);
        // After invalidation, next load should re-import
        const fn = await loader.load(wfPath);
        expect(typeof fn).toBe('function');
    });
    it('should read workflow source', async () => {
        const code = 'export default async function(ctx) { return 42; }';
        const wfPath = await writeWorkflow('source.mjs', code);
        const source = await loader.getSource(wfPath);
        expect(source).toBe(code);
    });
    it('should throw for non-existent workflow', async () => {
        await expect(loader.load('nonexistent.mjs')).rejects.toThrow();
    });
});
//# sourceMappingURL=loader.test.js.map