import { describe, it, expect, vi } from 'vitest';
import { getAbbreviatedRules, getAbbreviatedSkills } from '../../src/domain/prompt-augmentor/list-providers.js';
import { RuleEngine } from '../../src/domain/rule/engine.js';
import { Logger } from '../../src/logging/logger.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const logger = new Logger({ level: 'error' });

describe('getAbbreviatedRules', () => {
  it('returns enabled rules with name and description', () => {
    const engine = new RuleEngine(logger);
    engine.register({
      id: 'r1', name: 'Code Review', description: 'Review code',
      pattern: '.*', action: 'warn', category: 'general', enabled: true,
    });
    engine.register({
      id: 'r2', name: 'Workflow', description: 'Workflow protocol',
      pattern: '.*', action: 'warn', category: 'general', enabled: true,
    });

    const result = getAbbreviatedRules(engine);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'Code Review', description: 'Review code' });
    expect(result[1]).toEqual({ name: 'Workflow', description: 'Workflow protocol' });
  });

  it('skips disabled rules', () => {
    const engine = new RuleEngine(logger);
    engine.register({
      id: 'r1', name: 'Active', description: 'active',
      pattern: '.*', action: 'warn', category: 'general', enabled: true,
    });
    engine.register({
      id: 'r2', name: 'Disabled', description: 'disabled',
      pattern: '.*', action: 'warn', category: 'general', enabled: false,
    });

    const result = getAbbreviatedRules(engine);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Active');
  });
});

describe('getAbbreviatedSkills', () => {
  it('extracts name and description from .md frontmatter', async () => {
    const dir = join(tmpdir(), `skills-test-${Date.now()}`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      join(dir, 'code-review.md'),
      '---\ndescription: "Code review protocol"\n---\n# code-review\n',
    );

    const result = await getAbbreviatedSkills(dir);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'code-review', description: 'Code review protocol' });

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('returns empty array when directory does not exist', async () => {
    const result = await getAbbreviatedSkills('/tmp/nonexistent-skills-dir-xyz');
    expect(result).toEqual([]);
  });

  it('skips non-.md files', async () => {
    const dir = join(tmpdir(), `skills-skip-${Date.now()}`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, 'readme.txt'), 'not a skill');
    await fs.writeFile(
      join(dir, 'valid.md'),
      '---\ndescription: "Valid skill"\n---\n# valid\n',
    );

    const result = await getAbbreviatedSkills(dir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('valid');

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('returns empty array when fs.readFile throws inside loop', async () => {
    const dir = join(tmpdir(), `skills-err-${Date.now()}`);
    await fs.mkdir(dir, { recursive: true });
    // Create a .md entry that is actually a directory → readFile will throw
    await fs.mkdir(join(dir, 'broken.md'), { recursive: true });

    const result = await getAbbreviatedSkills(dir);
    expect(result).toEqual([]);

    await fs.rm(dir, { recursive: true, force: true });
  });
});
