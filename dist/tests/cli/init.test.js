import { describe, it, expect, afterEach } from 'vitest';
import { init } from '../../src/cli/init.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { HABITAT_DIR, ROLES_DIR, WORKFLOW_DIR, POSITIONS_DIR, MEMORY_DIR, EVENTS_DIR, LOGS_DIR, GLOBAL_MEMORY_ID, CONFIG_FILE, INDEX_FILE, META_FILE, LINKS_FILE, ENTRIES_SUBDIR, CONFIG_VERSION, } from '../../src/constants.js';
describe('CLI init', () => {
    let tmpDir;
    afterEach(async () => {
        if (tmpDir) {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });
    it('should create the full directory structure', async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'init-test-'));
        await init(tmpDir);
        const habitatDir = path.join(tmpDir, HABITAT_DIR);
        // Verify directories exist
        const dirs = [
            habitatDir,
            path.join(habitatDir, ROLES_DIR),
            path.join(habitatDir, WORKFLOW_DIR),
            path.join(habitatDir, POSITIONS_DIR),
            path.join(habitatDir, MEMORY_DIR, GLOBAL_MEMORY_ID, ENTRIES_SUBDIR),
            path.join(habitatDir, EVENTS_DIR),
            path.join(habitatDir, LOGS_DIR),
        ];
        for (const dir of dirs) {
            const stat = await fs.stat(dir);
            expect(stat.isDirectory()).toBe(true);
        }
    });
    it('should create config.json with correct structure', async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'init-test-'));
        await init(tmpDir);
        const configPath = path.join(tmpDir, HABITAT_DIR, CONFIG_FILE);
        const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
        expect(config.version).toBe(CONFIG_VERSION);
        expect(config.concurrency).toBeDefined();
        expect(config.concurrency.maxConcurrentPositions).toBeGreaterThan(0);
        expect(config.defaultModel).toBeDefined();
    });
    it('should create global memory index and meta', async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'init-test-'));
        await init(tmpDir);
        const globalDir = path.join(tmpDir, HABITAT_DIR, MEMORY_DIR, GLOBAL_MEMORY_ID);
        const index = JSON.parse(await fs.readFile(path.join(globalDir, INDEX_FILE), 'utf-8'));
        expect(index.version).toBeDefined();
        expect(index.keywords).toBeDefined();
        const meta = JSON.parse(await fs.readFile(path.join(globalDir, META_FILE), 'utf-8'));
        expect(meta.totalEntries).toBe(0);
    });
    it('should create cross-store links file', async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'init-test-'));
        await init(tmpDir);
        const linksPath = path.join(tmpDir, HABITAT_DIR, MEMORY_DIR, LINKS_FILE);
        const links = JSON.parse(await fs.readFile(linksPath, 'utf-8'));
        expect(links).toEqual([]);
    });
    it('should create role template files', async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'init-test-'));
        await init(tmpDir);
        const rolesDir = path.join(tmpDir, HABITAT_DIR, ROLES_DIR);
        const files = await fs.readdir(rolesDir);
        expect(files.length).toBeGreaterThan(0);
        // Verify at least org-architect template exists
        const orgArchitect = JSON.parse(await fs.readFile(path.join(rolesDir, 'org-architect.json'), 'utf-8'));
        expect(orgArchitect.name).toBe('org-architect');
        expect(orgArchitect.isAdmin).toBe(true);
    });
    it('should skip if already initialized', async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'init-test-'));
        await init(tmpDir);
        // Second init should not throw
        await init(tmpDir);
        // Config should still be valid
        const configPath = path.join(tmpDir, HABITAT_DIR, CONFIG_FILE);
        const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
        expect(config.version).toBe(CONFIG_VERSION);
    });
});
//# sourceMappingURL=init.test.js.map