import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JsonStore } from '../../src/infra/json-store.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('JsonStore', () => {
  let dir: string;
  let store: JsonStore<{ name: string; value: number }>;

  beforeEach(async () => {
    dir = join(tmpdir(), `json-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    store = new JsonStore(dir);
    await store.ensureDir();
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('saves and loads an item', async () => {
    await store.save('item-1', { name: 'test', value: 42 });
    const loaded = await store.load('item-1');
    expect(loaded).toEqual({ name: 'test', value: 42 });
  });

  it('returns null for missing item', async () => {
    const loaded = await store.load('nonexistent');
    expect(loaded).toBeNull();
  });

  it('checks existence', async () => {
    expect(await store.exists('item-1')).toBe(false);
    await store.save('item-1', { name: 'a', value: 1 });
    expect(await store.exists('item-1')).toBe(true);
  });

  it('deletes an item', async () => {
    await store.save('item-1', { name: 'a', value: 1 });
    expect(await store.delete('item-1')).toBe(true);
    expect(await store.exists('item-1')).toBe(false);
  });

  it('returns false when deleting nonexistent', async () => {
    expect(await store.delete('nope')).toBe(false);
  });

  it('lists all IDs', async () => {
    await store.save('a', { name: 'a', value: 1 });
    await store.save('b', { name: 'b', value: 2 });
    const ids = await store.list();
    expect(ids.sort()).toEqual(['a', 'b']);
  });

  it('lists empty when dir missing', async () => {
    const s = new JsonStore<unknown>(join(dir, 'nope'));
    expect(await s.list()).toEqual([]);
  });

  it('loads all items', async () => {
    await store.save('a', { name: 'a', value: 1 });
    await store.save('b', { name: 'b', value: 2 });
    const all = await store.loadAll();
    expect(all).toHaveLength(2);
  });

  it('supports custom extension', async () => {
    const s = new JsonStore<string>(dir, { extension: '.txt' });
    await s.save('hello', 'world');
    const files = await fs.readdir(dir);
    expect(files).toContain('hello.txt');
  });

  it('supports custom serialize/deserialize', async () => {
    const s = new JsonStore<string>(dir, {
      serialize: (v) => v.toUpperCase(),
      deserialize: (v) => v.toLowerCase(),
    });
    await s.save('test', 'Hello');
    const raw = await fs.readFile(join(dir, 'test.json'), 'utf-8');
    expect(raw).toBe('HELLO');
    expect(await s.load('test')).toBe('hello');
  });

  it('rejects path traversal on save', async () => {
    await expect(store.save('../escape', { name: 'x', value: 0 })).rejects.toThrow('Path traversal detected');
  });

  it('rejects path traversal on load', async () => {
    await expect(store.load('../../etc/passwd')).rejects.toThrow('Path traversal detected');
  });

  it('rejects path traversal on delete', async () => {
    await expect(store.delete('../escape')).rejects.toThrow('Path traversal detected');
  });

  it('rejects path traversal on exists', async () => {
    await expect(store.exists('../escape')).rejects.toThrow('Path traversal detected');
  });

  it('allows legitimate subdirectory IDs', async () => {
    await store.save('sub/item', { name: 'nested', value: 99 });
    const loaded = await store.load('sub/item');
    expect(loaded).toEqual({ name: 'nested', value: 99 });
  });

  it('delete rethrows non-ENOENT errors', async () => {
    // Point store at a file (not a dir) so unlink gets a path error
    const filePath = join(dir, 'afile');
    await fs.writeFile(filePath, 'x');
    const badStore = new JsonStore<unknown>(filePath);
    // Trying to delete inside a file-as-dir triggers ENOTDIR
    await expect(badStore.delete('sub')).rejects.toThrow();
  });

  it('exists rethrows non-ENOENT errors', async () => {
    const filePath = join(dir, 'afile');
    await fs.writeFile(filePath, 'x');
    const badStore = new JsonStore<unknown>(filePath);
    await expect(badStore.exists('sub')).rejects.toThrow();
  });

  it('load rethrows non-ENOENT errors', async () => {
    // Reading a directory as a file triggers EISDIR
    const badStore = new JsonStore<unknown>(dir);
    const subDir = join(dir, 'subdir.json');
    await fs.mkdir(subDir, { recursive: true });
    await expect(badStore.load('subdir')).rejects.toThrow();
  });

  it('list rethrows non-ENOENT errors', async () => {
    const filePath = join(dir, 'afile');
    await fs.writeFile(filePath, 'x');
    const badStore = new JsonStore<unknown>(filePath);
    await expect(badStore.list()).rejects.toThrow();
  });
});
