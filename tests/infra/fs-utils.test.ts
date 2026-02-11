import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isEnoent, readFileOrNull, readdirOrEmpty } from '../../src/infra/fs-utils.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('fs-utils', () => {
  let dir: string;

  beforeEach(async () => {
    dir = join(tmpdir(), `fs-utils-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  describe('isEnoent', () => {
    it('returns true for ENOENT errors', () => {
      const err = Object.assign(new Error('not found'), { code: 'ENOENT' });
      expect(isEnoent(err)).toBe(true);
    });

    it('returns false for other errors', () => {
      const err = Object.assign(new Error('permission'), { code: 'EACCES' });
      expect(isEnoent(err)).toBe(false);
    });

    it('returns false for plain errors', () => {
      expect(isEnoent(new Error('generic'))).toBe(false);
    });
  });

  describe('readFileOrNull', () => {
    it('reads an existing file', async () => {
      const filePath = join(dir, 'test.txt');
      await fs.writeFile(filePath, 'hello');
      expect(await readFileOrNull(filePath)).toBe('hello');
    });

    it('returns null for missing file', async () => {
      expect(await readFileOrNull(join(dir, 'nope.txt'))).toBeNull();
    });

    it('throws for non-ENOENT errors', async () => {
      // Reading a directory as a file triggers EISDIR
      await expect(readFileOrNull(dir)).rejects.toThrow();
    });
  });

  describe('readdirOrEmpty', () => {
    it('reads an existing directory', async () => {
      await fs.writeFile(join(dir, 'a.txt'), 'a');
      await fs.writeFile(join(dir, 'b.txt'), 'b');
      const files = await readdirOrEmpty(dir);
      expect(files.sort()).toEqual(['a.txt', 'b.txt']);
    });

    it('returns empty array for missing directory', async () => {
      expect(await readdirOrEmpty(join(dir, 'nope'))).toEqual([]);
    });

    it('throws for non-ENOENT errors', async () => {
      // Reading a file as a directory triggers ENOTDIR
      const filePath = join(dir, 'afile.txt');
      await fs.writeFile(filePath, 'data');
      await expect(readdirOrEmpty(filePath)).rejects.toThrow();
    });
  });
});
