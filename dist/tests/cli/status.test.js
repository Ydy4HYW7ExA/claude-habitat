import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { status } from '../../src/cli/status.js';
import { init } from '../../src/cli/init.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
describe('CLI status', () => {
    let tmpDir;
    let consoleSpy;
    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'status-test-'));
        await init(tmpDir);
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });
    afterEach(async () => {
        vi.restoreAllMocks();
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
    it('should output status header', async () => {
        await status(tmpDir);
        const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
        expect(output).toContain('Claude Habitat Status');
    });
    it('should show no positions when none exist', async () => {
        await status(tmpDir);
        const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
        expect(output).toContain('(none)');
    });
    it('should show programs', async () => {
        await status(tmpDir);
        const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
        expect(output).toContain('Programs');
    });
    it('should show global memory section', async () => {
        await status(tmpDir);
        const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
        expect(output).toContain('Global Memory');
    });
    it('should show recent events section', async () => {
        await status(tmpDir);
        const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
        expect(output).toContain('Recent Events');
    });
});
//# sourceMappingURL=status.test.js.map