import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { installFiles, installClaudeMd } from '../../src/preset/installer.js';

function tmpDir(): string {
  return join(tmpdir(), `ch-test-${randomBytes(6).toString('hex')}`);
}

describe('installFiles', () => {
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

  it('copies new files', async () => {
    await fs.writeFile(join(src, 'a.md'), 'hello');
    await fs.writeFile(join(src, 'b.md'), 'world');

    const count = await installFiles(src, dest, '.md');

    expect(count).toBe(2);
    expect(await fs.readFile(join(dest, 'a.md'), 'utf-8')).toBe('hello');
    expect(await fs.readFile(join(dest, 'b.md'), 'utf-8')).toBe('world');
  });

  it('skips files with identical content', async () => {
    await fs.writeFile(join(src, 'a.md'), 'same');
    await fs.mkdir(dest, { recursive: true });
    await fs.writeFile(join(dest, 'a.md'), 'same');

    const count = await installFiles(src, dest, '.md');
    expect(count).toBe(0);
  });

  it('overwrites files with changed content', async () => {
    await fs.writeFile(join(src, 'a.md'), 'new');
    await fs.mkdir(dest, { recursive: true });
    await fs.writeFile(join(dest, 'a.md'), 'old');

    const count = await installFiles(src, dest, '.md');

    expect(count).toBe(1);
    expect(await fs.readFile(join(dest, 'a.md'), 'utf-8')).toBe('new');
  });

  it('filters by extension', async () => {
    await fs.writeFile(join(src, 'a.md'), 'md');
    await fs.writeFile(join(src, 'b.json'), 'json');

    const count = await installFiles(src, dest, '.md');

    expect(count).toBe(1);
    const files = await fs.readdir(dest);
    expect(files).toEqual(['a.md']);
  });

  it('creates dest directory if missing', async () => {
    await fs.writeFile(join(src, 'a.md'), 'hello');
    const deepDest = join(dest, 'sub', 'dir');

    const count = await installFiles(src, deepDest, '.md');

    expect(count).toBe(1);
    expect(await fs.readFile(join(deepDest, 'a.md'), 'utf-8')).toBe('hello');
  });

  it('returns 0 for missing source directory', async () => {
    const count = await installFiles('/nonexistent/path', dest, '.md');
    expect(count).toBe(0);
  });
});

describe('installClaudeMd', () => {
  let dir: string;
  let destPath: string;

  beforeEach(async () => {
    dir = tmpDir();
    await fs.mkdir(dir, { recursive: true });
    destPath = join(dir, 'CLAUDE.md');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('creates new file when none exists', async () => {
    const content = '<!-- claude-habitat-managed -->\n# Rules';
    const written = await installClaudeMd(content, destPath);

    expect(written).toBe(true);
    expect(await fs.readFile(destPath, 'utf-8')).toBe(content);
  });

  it('skips when content is identical', async () => {
    const content = '<!-- claude-habitat-managed -->\n# Rules';
    await fs.writeFile(destPath, content);

    const written = await installClaudeMd(content, destPath);
    expect(written).toBe(false);
  });

  it('skips non-managed file', async () => {
    await fs.writeFile(destPath, '# My custom rules');
    const content = '<!-- claude-habitat-managed -->\n# Rules';

    const written = await installClaudeMd(content, destPath);

    expect(written).toBe(false);
    expect(await fs.readFile(destPath, 'utf-8')).toBe('# My custom rules');
  });

  it('overwrites managed file with new content', async () => {
    await fs.writeFile(destPath, '<!-- claude-habitat-managed -->\n# Old');
    const content = '<!-- claude-habitat-managed -->\n# New';

    const written = await installClaudeMd(content, destPath);

    expect(written).toBe(true);
    expect(await fs.readFile(destPath, 'utf-8')).toBe(content);
  });
});
