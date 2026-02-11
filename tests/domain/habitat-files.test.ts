import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { HabitatFileService } from '../../src/domain/habitat-files/service.js';
import { Logger } from '../../src/logging/logger.js';

function tmpDir(): string {
  return join(tmpdir(), `ch-hfs-${randomBytes(6).toString('hex')}`);
}

describe('HabitatFileService', () => {
  let habitatDir: string;
  let claudeDir: string;
  let svc: HabitatFileService;

  beforeEach(async () => {
    habitatDir = tmpDir();
    claudeDir = tmpDir();
    await fs.mkdir(habitatDir, { recursive: true });
    await fs.mkdir(claudeDir, { recursive: true });
    const logger = new Logger({ level: 'error' });
    svc = new HabitatFileService(habitatDir, claudeDir, logger);
  });

  afterEach(async () => {
    await fs.rm(habitatDir, { recursive: true, force: true });
    await fs.rm(claudeDir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('creates a command file and symlink', async () => {
      const result = await svc.create({
        name: 'habitat-test', kind: 'command', scope: 'global', content: '# Test',
      });

      expect(result.name).toBe('habitat-test');
      expect(result.filePath).toContain('commands/habitat-test.md');
      expect(await fs.readFile(result.filePath, 'utf-8')).toBe('# Test');

      // Symlink should exist
      const stat = await fs.lstat(result.symlinkPath!);
      expect(stat.isSymbolicLink()).toBe(true);
    });

    it('creates a skill file and symlink', async () => {
      const result = await svc.create({
        name: 'habitat-review', kind: 'skill', scope: 'global', content: '# Review',
      });

      expect(result.kind).toBe('skill');
      expect(result.filePath).toContain('skills/habitat-review.md');
      expect(result.symlinkPath).toBeDefined();
    });

    it('creates a rule file without symlink', async () => {
      // Need rules dir with valid JSON for generateClaudeMd
      const rulesDir = join(habitatDir, 'rules');
      await fs.mkdir(rulesDir, { recursive: true });

      const ruleContent = JSON.stringify({
        id: 'habitat-myrule', name: 'My Rule', priority: 'low', content: '## My Rule',
      });
      const result = await svc.create({
        name: 'habitat-myrule', kind: 'rule', scope: 'global', content: ruleContent,
      });

      expect(result.symlinkPath).toBeUndefined();
      expect(result.filePath).toContain('rules/habitat-myrule.json');
    });

    it('rejects duplicate names', async () => {
      await svc.create({
        name: 'habitat-dup', kind: 'command', scope: 'global', content: 'a',
      });

      await expect(svc.create({
        name: 'habitat-dup', kind: 'command', scope: 'global', content: 'b',
      })).rejects.toThrow('already exists');
    });

    it('rejects invalid names', async () => {
      await expect(svc.create({
        name: 'bad-name', kind: 'command', scope: 'global', content: 'x',
      })).rejects.toThrow('Invalid name');
    });

    it('rejects non-kebab-case names', async () => {
      await expect(svc.create({
        name: 'habitat-BadCase', kind: 'command', scope: 'global', content: 'x',
      })).rejects.toThrow('Invalid name');
    });
  });

  describe('read', () => {
    it('reads an existing command', async () => {
      await svc.create({
        name: 'habitat-rd', kind: 'command', scope: 'global', content: '# Read me',
      });

      const result = await svc.read('habitat-rd', 'command', 'global');
      expect(result.content).toBe('# Read me');
      expect(result.name).toBe('habitat-rd');
    });

    it('throws NotFoundError for missing file', async () => {
      await expect(svc.read('habitat-nope', 'command', 'global'))
        .rejects.toThrow('not found');
    });
  });

  describe('update', () => {
    it('updates command content', async () => {
      await svc.create({
        name: 'habitat-upd', kind: 'command', scope: 'global', content: 'old',
      });

      const result = await svc.update({
        name: 'habitat-upd', kind: 'command', scope: 'global', content: 'new',
      });

      expect(result.content).toBe('new');
      const onDisk = await fs.readFile(result.filePath, 'utf-8');
      expect(onDisk).toBe('new');
    });

    it('throws NotFoundError when updating nonexistent file', async () => {
      await expect(svc.update({
        name: 'habitat-ghost', kind: 'command', scope: 'global', content: 'x',
      })).rejects.toThrow('not found');
    });
  });

  describe('delete', () => {
    it('deletes command file and symlink', async () => {
      const created = await svc.create({
        name: 'habitat-del', kind: 'command', scope: 'global', content: 'bye',
      });

      await svc.delete('habitat-del', 'command', 'global');

      // Source file gone
      await expect(fs.access(created.filePath)).rejects.toThrow();
      // Symlink gone
      await expect(fs.access(created.symlinkPath!)).rejects.toThrow();
    });

    it('throws NotFoundError when deleting nonexistent file', async () => {
      await expect(svc.delete('habitat-nope', 'command', 'global'))
        .rejects.toThrow('not found');
    });
  });

  describe('list', () => {
    it('lists all commands', async () => {
      await svc.create({
        name: 'habitat-one', kind: 'command', scope: 'global', content: '1',
      });
      await svc.create({
        name: 'habitat-two', kind: 'command', scope: 'global', content: '2',
      });

      const results = await svc.list('command', 'global');
      expect(results).toHaveLength(2);
      const names = results.map((r) => r.name).sort();
      expect(names).toEqual(['habitat-one', 'habitat-two']);
    });

    it('returns empty array for empty directory', async () => {
      const results = await svc.list('skill', 'global');
      expect(results).toEqual([]);
    });
  });
});