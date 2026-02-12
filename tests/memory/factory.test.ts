import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileMemoryStoreFactory } from '../../src/memory/factory.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { MEMORY_LAYER } from '../../src/constants.js';

describe('FileMemoryStoreFactory', () => {
  let tmpDir: string;
  let factory: FileMemoryStoreFactory;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-test-'));
    factory = new FileMemoryStoreFactory(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should return the same store instance for the same positionId', () => {
    const store1 = factory.getStore('pos-1');
    const store2 = factory.getStore('pos-1');
    expect(store1).toBe(store2);
  });

  it('should return different stores for different positionIds', () => {
    const store1 = factory.getStore('pos-1');
    const store2 = factory.getStore('pos-2');
    expect(store1).not.toBe(store2);
  });

  it('should return a global store', () => {
    const global = factory.getGlobalStore();
    expect(global).toBeDefined();
  });

  it('should search across multiple stores', async () => {
    const store1 = factory.getStore('pos-1');
    const store2 = factory.getStore('pos-2');

    await store1.write({
      layer: MEMORY_LAYER.EPISODE,
      content: 'TypeScript patterns',
      summary: 'TS patterns',
      keywords: ['typescript', 'patterns'],
      refs: [],
      metadata: { positionId: 'pos-1' },
    });

    await store2.write({
      layer: MEMORY_LAYER.EPISODE,
      content: 'TypeScript testing',
      summary: 'TS testing',
      keywords: ['typescript', 'testing'],
      refs: [],
      metadata: { positionId: 'pos-2' },
    });

    const results = await factory.searchAcross('typescript');
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every(r => r.entry.keywords.includes('typescript'))).toBe(true);
  });

  it('should create and retrieve links', async () => {
    await factory.link('e-001', 'e-002', 'related');
    const links = await factory.getLinks('e-001');

    expect(links).toHaveLength(1);
    expect(links[0].fromId).toBe('e-001');
    expect(links[0].toId).toBe('e-002');
    expect(links[0].relation).toBe('related');
  });

  it('should find links from either direction', async () => {
    await factory.link('e-001', 'e-002', 'related');
    const links = await factory.getLinks('e-002');

    expect(links).toHaveLength(1);
    expect(links[0].toId).toBe('e-002');
  });
});
