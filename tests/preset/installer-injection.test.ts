import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { injectMarkerSection, removeMarkerSection } from '../../src/preset/installer.js';

function tmpDir(): string {
  return join(tmpdir(), `ch-inj-${randomBytes(6).toString('hex')}`);
}

describe('injectMarkerSection', () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = tmpDir();
    await fs.mkdir(dir, { recursive: true });
    filePath = join(dir, 'CLAUDE.md');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('creates file when none exists', async () => {
    const modified = await injectMarkerSection(filePath, 'hello world');

    expect(modified).toBe(true);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toContain('<!-- habitat-begin -->');
    expect(content).toContain('hello world');
    expect(content).toContain('<!-- habitat-end -->');
  });

  it('appends to file without markers', async () => {
    await fs.writeFile(filePath, '# My Rules\n\nCustom content here.\n');

    const modified = await injectMarkerSection(filePath, 'injected');

    expect(modified).toBe(true);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toContain('# My Rules');
    expect(content).toContain('Custom content here.');
    expect(content).toContain('<!-- habitat-begin -->');
    expect(content).toContain('injected');
  });

  it('replaces content between existing markers', async () => {
    await fs.writeFile(filePath, [
      '# User content',
      '',
      '<!-- habitat-begin -->',
      'old stuff',
      '<!-- habitat-end -->',
      '',
      '# More user content',
    ].join('\n'));

    const modified = await injectMarkerSection(filePath, 'new stuff');

    expect(modified).toBe(true);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toContain('# User content');
    expect(content).toContain('new stuff');
    expect(content).toContain('# More user content');
    expect(content).not.toContain('old stuff');
  });

  it('skips write when content is identical', async () => {
    const section = '<!-- habitat-begin -->\nsame\n<!-- habitat-end -->\n';
    await fs.writeFile(filePath, section);

    const modified = await injectMarkerSection(filePath, 'same');
    expect(modified).toBe(false);
  });

  it('throws on unpaired markers', async () => {
    await fs.writeFile(filePath, '<!-- habitat-begin -->\nbroken');

    await expect(injectMarkerSection(filePath, 'x'))
      .rejects.toThrow('unpaired');
  });

  it('migrates old CLAUDE_MD_MARKER', async () => {
    await fs.writeFile(filePath, '<!-- claude-habitat-managed -->\n# Old content');

    const modified = await injectMarkerSection(filePath, 'new content');

    expect(modified).toBe(true);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).not.toContain('<!-- claude-habitat-managed -->');
    expect(content).toContain('<!-- habitat-begin -->');
    expect(content).toContain('new content');
  });
});

describe('removeMarkerSection', () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = tmpDir();
    await fs.mkdir(dir, { recursive: true });
    filePath = join(dir, 'CLAUDE.md');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('removes marker section from file', async () => {
    await fs.writeFile(filePath, [
      '# User content',
      '',
      '<!-- habitat-begin -->',
      'habitat stuff',
      '<!-- habitat-end -->',
      '',
      '# More user content',
    ].join('\n'));

    const modified = await removeMarkerSection(filePath);

    expect(modified).toBe(true);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toContain('# User content');
    expect(content).toContain('# More user content');
    expect(content).not.toContain('habitat-begin');
    expect(content).not.toContain('habitat stuff');
  });

  it('deletes file if only marker section remains', async () => {
    await fs.writeFile(filePath, '<!-- habitat-begin -->\nstuff\n<!-- habitat-end -->\n');

    const modified = await removeMarkerSection(filePath);

    expect(modified).toBe(true);
    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it('returns false when file has no markers', async () => {
    await fs.writeFile(filePath, '# Just user content\n');

    const modified = await removeMarkerSection(filePath);
    expect(modified).toBe(false);
  });

  it('returns false when file does not exist', async () => {
    const modified = await removeMarkerSection(join(dir, 'nope.md'));
    expect(modified).toBe(false);
  });
});