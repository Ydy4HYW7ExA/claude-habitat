import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import {
  ensureSymlink, removeSymlink, syncSymlinks, removeSymlinks,
} from '../../src/preset/symlinker.js';

function tmpDir(): string {
  return join(tmpdir(), `ch-sym-${randomBytes(6).toString('hex')}`);
}

describe('ensureSymlink', () => {
  let src: string;
  let dest: string;

  beforeEach(async () => {
    src = tmpDir();
    dest = tmpDir();
    await fs.mkdir(src, { recursive: true });
    await fs.mkdir(dest, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(src, { recursive: true, force: true });
    await fs.rm(dest, { recursive: true, force: true });
  });

  it('creates a new symlink', async () => {
    const srcFile = join(src, 'a.md');
    await fs.writeFile(srcFile, 'hello');
    const destFile = join(dest, 'a.md');

    const created = await ensureSymlink(srcFile, destFile);

    expect(created).toBe(true);
    const stat = await fs.lstat(destFile);
    expect(stat.isSymbolicLink()).toBe(true);
    expect(await fs.readFile(destFile, 'utf-8')).toBe('hello');
  });

  it('skips if symlink already points to correct target', async () => {
    const srcFile = join(src, 'a.md');
    await fs.writeFile(srcFile, 'hello');
    const destFile = join(dest, 'a.md');
    await fs.symlink(resolve(srcFile), destFile);

    const created = await ensureSymlink(srcFile, destFile);
    expect(created).toBe(false);
  });

  it('replaces symlink pointing to wrong target', async () => {
    const srcFile = join(src, 'a.md');
    await fs.writeFile(srcFile, 'correct');
    const wrongFile = join(src, 'wrong.md');
    await fs.writeFile(wrongFile, 'wrong');
    const destFile = join(dest, 'a.md');
    await fs.symlink(resolve(wrongFile), destFile);

    const created = await ensureSymlink(srcFile, destFile);

    expect(created).toBe(true);
    expect(await fs.readFile(destFile, 'utf-8')).toBe('correct');
  });

  it('does not touch regular files', async () => {
    const srcFile = join(src, 'a.md');
    await fs.writeFile(srcFile, 'new');
    const destFile = join(dest, 'a.md');
    await fs.writeFile(destFile, 'existing');

    const created = await ensureSymlink(srcFile, destFile);

    expect(created).toBe(false);
    expect(await fs.readFile(destFile, 'utf-8')).toBe('existing');
  });
});

describe('removeSymlink', () => {
  let dir: string;

  beforeEach(async () => {
    dir = tmpDir();
    await fs.mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('removes a symlink', async () => {
    const target = join(dir, 'target.md');
    await fs.writeFile(target, 'x');
    const link = join(dir, 'link.md');
    await fs.symlink(resolve(target), link);

    const removed = await removeSymlink(link);
    expect(removed).toBe(true);

    const entries = await fs.readdir(dir);
    expect(entries).toEqual(['target.md']);
  });

  it('does not remove regular files', async () => {
    const file = join(dir, 'regular.md');
    await fs.writeFile(file, 'keep');

    const removed = await removeSymlink(file);
    expect(removed).toBe(false);
    expect(await fs.readFile(file, 'utf-8')).toBe('keep');
  });

  it('returns false for nonexistent path', async () => {
    const removed = await removeSymlink(join(dir, 'nope'));
    expect(removed).toBe(false);
  });
});

describe('syncSymlinks', () => {
  let src: string;
  let dest: string;

  beforeEach(async () => {
    src = tmpDir();
    dest = tmpDir();
    await fs.mkdir(src, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(src, { recursive: true, force: true });
    await fs.rm(dest, { recursive: true, force: true });
  });

  it('creates symlinks for matching files', async () => {
    await fs.writeFile(join(src, 'habitat-a.md'), 'a');
    await fs.writeFile(join(src, 'habitat-b.md'), 'b');

    const result = await syncSymlinks(src, dest, /^habitat-.*\.md$/);

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.removed).toBe(0);
    expect(await fs.readFile(join(dest, 'habitat-a.md'), 'utf-8')).toBe('a');
  });

  it('skips already correct symlinks', async () => {
    await fs.writeFile(join(src, 'habitat-a.md'), 'a');
    await syncSymlinks(src, dest, /^habitat-.*\.md$/);

    const result = await syncSymlinks(src, dest, /^habitat-.*\.md$/);
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('only matches files fitting the pattern', async () => {
    await fs.writeFile(join(src, 'habitat-a.md'), 'a');
    await fs.writeFile(join(src, 'other.md'), 'other');
    await fs.writeFile(join(src, 'habitat-b.json'), 'json');

    const result = await syncSymlinks(src, dest, /^habitat-.*\.md$/);
    expect(result.created).toBe(1);

    const entries = await fs.readdir(dest);
    expect(entries).toEqual(['habitat-a.md']);
  });

  it('cleans stale symlinks', async () => {
    await fs.writeFile(join(src, 'habitat-a.md'), 'a');
    await syncSymlinks(src, dest, /^habitat-.*\.md$/);

    // Remove source file
    await fs.unlink(join(src, 'habitat-a.md'));

    const result = await syncSymlinks(src, dest, /^habitat-.*\.md$/);
    expect(result.removed).toBe(1);

    const entries = await fs.readdir(dest);
    expect(entries).toEqual([]);
  });

  it('does not remove non-habitat symlinks during cleanup', async () => {
    await fs.writeFile(join(src, 'habitat-a.md'), 'a');
    await syncSymlinks(src, dest, /^habitat-.*\.md$/);

    // Add a regular file in dest
    await fs.writeFile(join(dest, 'user-file.md'), 'user');

    await fs.unlink(join(src, 'habitat-a.md'));
    await syncSymlinks(src, dest, /^habitat-.*\.md$/);

    const entries = await fs.readdir(dest);
    expect(entries).toEqual(['user-file.md']);
  });
});

describe('removeSymlinks', () => {
  let src: string;
  let dest: string;

  beforeEach(async () => {
    src = tmpDir();
    dest = tmpDir();
    await fs.mkdir(src, { recursive: true });
    await fs.mkdir(dest, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(src, { recursive: true, force: true });
    await fs.rm(dest, { recursive: true, force: true });
  });

  it('removes symlinks pointing into srcDir', async () => {
    await fs.writeFile(join(src, 'a.md'), 'a');
    await fs.symlink(resolve(join(src, 'a.md')), join(dest, 'a.md'));

    const removed = await removeSymlinks(src, dest);
    expect(removed).toBe(1);
    const entries = await fs.readdir(dest);
    expect(entries).toEqual([]);
  });

  it('does not remove regular files', async () => {
    await fs.writeFile(join(dest, 'user.md'), 'keep');

    const removed = await removeSymlinks(src, dest);
    expect(removed).toBe(0);
    expect(await fs.readFile(join(dest, 'user.md'), 'utf-8')).toBe('keep');
  });

  it('does not remove symlinks pointing elsewhere', async () => {
    const other = tmpDir();
    await fs.mkdir(other, { recursive: true });
    await fs.writeFile(join(other, 'x.md'), 'x');
    await fs.symlink(resolve(join(other, 'x.md')), join(dest, 'x.md'));

    const removed = await removeSymlinks(src, dest);
    expect(removed).toBe(0);

    await fs.rm(other, { recursive: true, force: true });
  });
});
