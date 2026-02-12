import { describe, it, expect, afterEach } from 'vitest';
import { init } from '../../src/cli/init.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  HABITAT_DIR, PROGRAM_DIR, PROGRAM_SDK_DIR, PROGRAM_APP_DIR,
  DATA_DIR, SHARED_DATA_ID, PROCESS_DIR, MANIFEST_FILE,
  CONFIG_FILE, INDEX_FILE, META_FILE, LINKS_FILE,
  ENTRIES_SUBDIR, CONFIG_VERSION,
} from '../../src/constants.js';

describe('CLI init', () => {
  let tmpDir: string;

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
      path.join(habitatDir, PROGRAM_DIR, PROGRAM_SDK_DIR),
      path.join(habitatDir, PROGRAM_DIR, PROGRAM_APP_DIR),
      path.join(habitatDir, DATA_DIR, SHARED_DATA_ID, 'memory', ENTRIES_SUBDIR),
      path.join(habitatDir, DATA_DIR, SHARED_DATA_ID, 'events'),
      path.join(habitatDir, DATA_DIR, SHARED_DATA_ID, 'logs'),
      path.join(habitatDir, PROCESS_DIR),
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

    const globalDir = path.join(tmpDir, HABITAT_DIR, DATA_DIR, SHARED_DATA_ID, 'memory');

    const index = JSON.parse(await fs.readFile(path.join(globalDir, INDEX_FILE), 'utf-8'));
    expect(index.version).toBeDefined();
    expect(index.keywords).toBeDefined();

    const meta = JSON.parse(await fs.readFile(path.join(globalDir, META_FILE), 'utf-8'));
    expect(meta.totalEntries).toBe(0);
  });

  it('should create cross-store links file', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'init-test-'));
    await init(tmpDir);

    const linksPath = path.join(tmpDir, HABITAT_DIR, DATA_DIR, SHARED_DATA_ID, LINKS_FILE);
    const links = JSON.parse(await fs.readFile(linksPath, 'utf-8'));
    expect(links).toEqual([]);
  });

  it('should create program manifest files', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'init-test-'));
    await init(tmpDir);

    const appDir = path.join(tmpDir, HABITAT_DIR, PROGRAM_DIR, PROGRAM_APP_DIR);
    const entries = await fs.readdir(appDir);
    expect(entries.length).toBeGreaterThan(0);

    // Verify at least org-architect program exists
    const orgArchitect = JSON.parse(
      await fs.readFile(path.join(appDir, 'org-architect', MANIFEST_FILE), 'utf-8'),
    );
    expect(orgArchitect.name).toBe('org-architect');
    expect(orgArchitect.isAdmin).toBe(true);
  });

  it('should create SDK declaration files', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'init-test-'));
    await init(tmpDir);

    const sdkDir = path.join(tmpDir, HABITAT_DIR, PROGRAM_DIR, PROGRAM_SDK_DIR);

    const memory = JSON.parse(await fs.readFile(path.join(sdkDir, 'memory.json'), 'utf-8'));
    expect(memory.name).toBe('memory');
    expect(memory.capabilities.layers).toContain('episode');
    expect(memory.dataLayout.shared).toContain('_shared');

    const events = JSON.parse(await fs.readFile(path.join(sdkDir, 'events.json'), 'utf-8'));
    expect(events.name).toBe('events');
    expect(events.capabilities.patterns).toContain('publish-subscribe');
    expect(events.dataLayout.events).toContain('_shared');
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
