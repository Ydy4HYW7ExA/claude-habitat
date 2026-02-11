import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SkillParser } from '../../src/domain/skill/parser.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('SkillParser', () => {
  let dir: string;
  let parser: SkillParser;

  beforeEach(async () => {
    dir = join(tmpdir(), `skill-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(dir, { recursive: true });
    parser = new SkillParser(dir);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  // --- Format A: simple numbered list ---
  describe('Format A (simple list)', () => {
    it('parses simple numbered steps', async () => {
      await fs.mkdir(join(dir, 'simple-skill'), { recursive: true });
      await fs.writeFile(
        join(dir, 'simple-skill', 'protocol.md'),
        [
          '# Simple Skill',
          '',
          'A simple skill for testing.',
          '',
          '## Steps',
          '',
          '1. First step description',
          '2. Second step description',
          '3. Third step description',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('simple-skill');
      expect(skill.name).toBe('simple-skill');
      expect(skill.description).toBe('A simple skill for testing.');
      expect(skill.steps).toHaveLength(3);
      expect(skill.steps[0].number).toBe(1);
      expect(skill.steps[0].name).toBe('First step description');
      expect(skill.steps[2].number).toBe(3);
    });

    it('skips non-matching lines in Format A steps', async () => {
      await fs.mkdir(join(dir, 'fmt-a-gaps'), { recursive: true });
      await fs.writeFile(
        join(dir, 'fmt-a-gaps', 'protocol.md'),
        [
          '# Format A Gaps',
          '',
          'Gaps between steps.',
          '',
          '## Steps',
          '',
          '1. First step',
          '',
          'Some random text',
          '2. Second step',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('fmt-a-gaps');
      expect(skill.steps).toHaveLength(2);
      expect(skill.steps[0].name).toBe('First step');
      expect(skill.steps[1].name).toBe('Second step');
    });

    it('parses annotations on simple steps', async () => {
      await fs.mkdir(join(dir, 'annotated'), { recursive: true });
      await fs.writeFile(
        join(dir, 'annotated', 'protocol.md'),
        [
          '# Annotated',
          '',
          'Skill with annotations.',
          '',
          '## Steps',
          '',
          '1. Check code correctness [independent]',
          '2. Evaluate style [independent]',
          '3. Provide feedback [user-decision]',
          '4. Final review [depends on: #1, #2]',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('annotated');
      expect(skill.steps).toHaveLength(4);
      expect(skill.steps[0].annotations).toEqual([{ type: 'independent' }]);
      expect(skill.steps[2].annotations).toEqual([{ type: 'user-decision' }]);
      expect(skill.steps[3].annotations).toEqual([
        { type: 'depends-on', steps: [1, 2] },
      ]);
    });
  });

  // --- Format B: bold name with sub-items ---
  describe('Format B (bold name + sub-items)', () => {
    it('parses bold-name steps with sub-items', async () => {
      await fs.mkdir(join(dir, 'bold-skill'), { recursive: true });
      await fs.writeFile(
        join(dir, 'bold-skill', 'protocol.md'),
        [
          '# Bold Skill',
          '',
          'A skill with bold step names.',
          '',
          '## Steps',
          '',
          '1. **Setup**: Configure the environment',
          '   - Install dependencies',
          '   - Validation: All deps installed',
          '   - Expected outcome: Environment ready',
          '   - [independent]',
          '',
          '2. **Execute**: Run the main logic',
          '   - Process input data',
          '   - [depends on: #1]',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('bold-skill');
      expect(skill.steps).toHaveLength(2);
      expect(skill.steps[0].name).toBe('Setup');
      expect(skill.steps[0].description).toContain('Configure the environment');
      expect(skill.steps[0].description).toContain('Install dependencies');
      expect(skill.steps[0].validation).toBe('All deps installed');
      expect(skill.steps[0].expectedOutcome).toBe('Environment ready');
      expect(skill.steps[0].annotations).toContainEqual({ type: 'independent' });
      expect(skill.steps[1].name).toBe('Execute');
      expect(skill.steps[1].annotations).toContainEqual({
        type: 'depends-on',
        steps: [1],
      });
    });

    it('appends plain sub-item to empty description', async () => {
      await fs.mkdir(join(dir, 'empty-desc'), { recursive: true });
      await fs.writeFile(
        join(dir, 'empty-desc', 'protocol.md'),
        [
          '# Empty Desc',
          '',
          'Empty description test.',
          '',
          '## Steps',
          '',
          '1. **Setup**:',
          '   - First sub-item',
          '   - Second sub-item',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('empty-desc');
      expect(skill.steps[0].description).toContain('First sub-item');
      expect(skill.steps[0].description).toContain('Second sub-item');
    });

    it('skips non-step lines before first bold step', async () => {
      await fs.mkdir(join(dir, 'pre-text-b'), { recursive: true });
      await fs.writeFile(
        join(dir, 'pre-text-b', 'protocol.md'),
        [
          '# Pre Text B',
          '',
          'Pre text test.',
          '',
          '## Steps',
          '',
          'Some preamble text before steps.',
          '',
          '1. **Step One**: Do something',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('pre-text-b');
      expect(skill.steps).toHaveLength(1);
      expect(skill.steps[0].name).toBe('Step One');
    });

    it('appends annotation sub-item text to description', async () => {
      await fs.mkdir(join(dir, 'annot-sub'), { recursive: true });
      await fs.writeFile(
        join(dir, 'annot-sub', 'protocol.md'),
        [
          '# Annot Sub',
          '',
          'Annotation sub-item test.',
          '',
          '## Steps',
          '',
          '1. **Check**:',
          '   - Review carefully [independent]',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('annot-sub');
      expect(skill.steps[0].annotations).toContainEqual({ type: 'independent' });
      expect(skill.steps[0].description).toContain('Review carefully');
    });
  });

  // --- Format C: heading-based steps ---
  describe('Format C (heading-based)', () => {
    it('parses heading-based steps', async () => {
      await fs.mkdir(join(dir, 'heading-skill'), { recursive: true });
      await fs.writeFile(
        join(dir, 'heading-skill', 'protocol.md'),
        [
          '# Heading Skill',
          '',
          'A skill with heading steps.',
          '',
          '## Steps',
          '',
          '### 1. Setup Environment',
          'Install all required tools.',
          '',
          '### 2. Run Tests [independent]',
          'Execute the test suite.',
          '',
          '### 3. Deploy',
          'Push to production.',
          '[depends on: #1, #2]',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('heading-skill');
      expect(skill.steps).toHaveLength(3);
      expect(skill.steps[0].number).toBe(1);
      expect(skill.steps[0].name).toBe('Setup Environment');
      expect(skill.steps[0].description).toBe('Install all required tools.');
      expect(skill.steps[1].annotations).toContainEqual({ type: 'independent' });
      expect(skill.steps[2].annotations).toContainEqual({
        type: 'depends-on',
        steps: [1, 2],
      });
    });

    it('skips non-heading lines before first step heading', async () => {
      await fs.mkdir(join(dir, 'pre-text-c'), { recursive: true });
      await fs.writeFile(
        join(dir, 'pre-text-c', 'protocol.md'),
        [
          '# Pre Text C',
          '',
          'Pre text test.',
          '',
          '## Steps',
          '',
          'Some preamble before headings.',
          '',
          '### 1. First Step',
          'Do something.',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('pre-text-c');
      expect(skill.steps).toHaveLength(1);
      expect(skill.steps[0].name).toBe('First Step');
    });
  });

  // --- YAML front matter ---
  describe('YAML front matter', () => {
    it('parses front matter metadata', async () => {
      await fs.writeFile(
        join(dir, 'meta-skill.md'),
        [
          '---',
          'name: meta-skill',
          'version: 1.0.0',
          'description: A skill with metadata',
          'author: Test Author',
          'category: testing',
          'difficulty: beginner',
          'tags: [review, quality]',
          'keywords: [test, example]',
          'estimatedDuration: 30',
          'prerequisites:',
          '  - Basic knowledge',
          '  - Tool installed',
          '---',
          '',
          '# Meta Skill',
          '',
          'A skill with full metadata.',
          '',
          '## Steps',
          '',
          '1. Do something',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('meta-skill');
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata!.name).toBe('meta-skill');
      expect(skill.metadata!.version).toBe('1.0.0');
      expect(skill.metadata!.author).toBe('Test Author');
      expect(skill.metadata!.tags).toEqual(['review', 'quality']);
      expect(skill.metadata!.keywords).toEqual(['test', 'example']);
      expect(skill.metadata!.estimatedDuration).toBe(30);
      expect(skill.metadata!.prerequisites).toEqual([
        'Basic knowledge',
        'Tool installed',
      ]);
    });

    it('works without front matter', async () => {
      await fs.writeFile(
        join(dir, 'no-meta.md'),
        ['# No Meta', '', 'Simple skill.', '', '## Steps', '', '1. Step one', ''].join('\n'),
      );
      const skill = await parser.resolve('no-meta');
      expect(skill.metadata).toBeUndefined();
      expect(skill.steps).toHaveLength(1);
    });

    it('handles unclosed frontmatter (no closing ---)', async () => {
      await fs.writeFile(
        join(dir, 'unclosed-fm.md'),
        [
          '---',
          'name: unclosed',
          'version: 1.0.0',
          '',
          '# Unclosed FM',
          '',
          'Description here.',
          '',
          '## Steps',
          '',
          '1. Step',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('unclosed-fm');
      // No closing ---, so metadata should be null/undefined
      expect(skill.metadata).toBeUndefined();
    });
  });

  // --- Quality gates ---
  describe('quality gates', () => {
    it('parses checkbox quality gates', async () => {
      await fs.writeFile(
        join(dir, 'qg-skill.md'),
        [
          '# QG Skill',
          '',
          'Quality gate test.',
          '',
          '## Steps',
          '',
          '1. Do work',
          '',
          '## Quality Gates',
          '',
          '- [ ] **Mandatory**: All tests pass',
          '- [ ] **Advisory**: Documentation complete',
          '- [ ] **Mandatory**: No vulnerabilities',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('qg-skill');
      expect(skill.qualityGates).toHaveLength(3);
      expect(skill.qualityGates[0]).toEqual({ level: 'mandatory', text: 'All tests pass' });
      expect(skill.qualityGates[1]).toEqual({ level: 'advisory', text: 'Documentation complete' });
    });

    it('parses plain list quality gates as mandatory', async () => {
      await fs.writeFile(
        join(dir, 'qg-plain.md'),
        [
          '# QG Plain',
          '',
          'Plain gates.',
          '',
          '## Steps',
          '',
          '1. Work',
          '',
          '## Quality Gates',
          '',
          '- All logic verified',
          '- No security issues',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('qg-plain');
      expect(skill.qualityGates).toHaveLength(2);
      expect(skill.qualityGates[0].level).toBe('mandatory');
      expect(skill.qualityGates[0].text).toBe('All logic verified');
    });
  });

  // --- Pitfalls ---
  describe('pitfalls', () => {
    it('parses structured pitfalls', async () => {
      await fs.writeFile(
        join(dir, 'pit-struct.md'),
        [
          '# Pit Struct',
          '',
          'Structured pitfalls.',
          '',
          '## Steps',
          '',
          '1. Work',
          '',
          '## Pitfalls',
          '',
          '**Stray**: This line appears before any heading',
          '',
          '### Pitfall 1: Skipping Validation',
          '',
          '**Problem**: Not verifying steps',
          '**Impact**: Errors cascade',
          '**Avoidance**: Always check',
          '**Example**: Running without compiling',
          '',
          '### Pitfall 2: Over-Engineering',
          '',
          '**Problem**: Adding unnecessary complexity',
          '**Impact**: Hard to maintain',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('pit-struct');
      expect(skill.pitfalls).toHaveLength(2);
      expect(skill.pitfalls[0].name).toBe('Skipping Validation');
      expect(skill.pitfalls[0].problem).toBe('Not verifying steps');
      expect(skill.pitfalls[0].impact).toBe('Errors cascade');
      expect(skill.pitfalls[0].avoidance).toBe('Always check');
      expect(skill.pitfalls[0].example).toBe('Running without compiling');
      expect(skill.pitfalls[1].name).toBe('Over-Engineering');
    });

    it('parses plain list pitfalls', async () => {
      await fs.writeFile(
        join(dir, 'pit-plain.md'),
        [
          '# Pit Plain',
          '',
          'Plain pitfalls.',
          '',
          '## Steps',
          '',
          '1. Work',
          '',
          '## Pitfalls',
          '',
          '- Focusing only on style',
          '- Not considering edge cases',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('pit-plain');
      expect(skill.pitfalls).toHaveLength(2);
      expect(skill.pitfalls[0].name).toBe('Focusing only on style');
    });
  });

  // --- Imports ---
  describe('imports', () => {
    it('parses bare @import directives', async () => {
      await fs.mkdir(join(dir, 'base-skill'), { recursive: true });
      await fs.writeFile(
        join(dir, 'base-skill', 'protocol.md'),
        ['# Base', '', 'Base skill.', '', '## Steps', '', '1. Base step', ''].join('\n'),
      );
      await fs.writeFile(
        join(dir, 'importer.md'),
        [
          '# Importer',
          '',
          'Imports another skill.',
          '',
          '@import base-skill',
          '',
          '## Steps',
          '',
          '1. My step',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('importer');
      expect(skill.imports).toContain('base-skill');
    });

    it('skips lines starting with code fence in imports', async () => {
      await fs.writeFile(
        join(dir, 'code-fence.md'),
        [
          '# Code Fence',
          '',
          'Has code fence line.',
          '',
          '```@import fake-skill',
          '',
          '## Steps',
          '',
          '1. Step',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('code-fence');
      expect(skill.imports).toEqual([]);
    });

    it('parses quoted @import directives', async () => {
      await fs.mkdir(join(dir, 'dep-skill'), { recursive: true });
      await fs.writeFile(
        join(dir, 'dep-skill', 'protocol.md'),
        ['# Dep', '', 'Dep skill.', '', '## Steps', '', '1. Dep step', ''].join('\n'),
      );
      await fs.writeFile(
        join(dir, 'quoted-imp.md'),
        [
          '# Quoted',
          '',
          'Quoted import.',
          '',
          '@import "dep-skill"',
          '',
          '## Steps',
          '',
          '1. My step',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('quoted-imp');
      expect(skill.imports).toContain('dep-skill');
    });
  });

  // --- Circular import detection ---
  describe('circular import detection', () => {
    it('throws on circular imports', async () => {
      await fs.writeFile(
        join(dir, 'cycle-a.md'),
        ['# A', '', 'Cycle A.', '', '@import cycle-b', '', '## Steps', '', '1. Step', ''].join('\n'),
      );
      await fs.writeFile(
        join(dir, 'cycle-b.md'),
        ['# B', '', 'Cycle B.', '', '@import cycle-a', '', '## Steps', '', '1. Step', ''].join('\n'),
      );
      await expect(parser.resolve('cycle-a')).rejects.toThrow(/[Cc]ircular/);
    });
  });

  // --- Caching ---
  describe('caching', () => {
    it('returns cached result on second call', async () => {
      await fs.writeFile(
        join(dir, 'cached.md'),
        ['# Cached', '', 'Cached skill.', '', '## Steps', '', '1. Step', ''].join('\n'),
      );
      const first = await parser.resolve('cached');
      const second = await parser.resolve('cached');
      expect(first).toBe(second);
    });

    it('clearCache forces re-parse', async () => {
      await fs.writeFile(
        join(dir, 'recache.md'),
        ['# V1', '', 'Version 1.', '', '## Steps', '', '1. Step', ''].join('\n'),
      );
      const first = await parser.resolve('recache');
      expect(first.description).toBe('Version 1.');

      parser.clearCache();
      await fs.writeFile(
        join(dir, 'recache.md'),
        ['# V2', '', 'Version 2.', '', '## Steps', '', '1. Step', ''].join('\n'),
      );
      const second = await parser.resolve('recache');
      expect(second.description).toBe('Version 2.');
    });
  });

  // --- Invalid skill name ---
  describe('validation', () => {
    it('rejects invalid skill names', async () => {
      await expect(parser.resolve('Invalid_Name')).rejects.toThrow(/[Ii]nvalid skill name/);
      await expect(parser.resolve('UPPER')).rejects.toThrow(/[Ii]nvalid skill name/);
      await expect(parser.resolve('has spaces')).rejects.toThrow(/[Ii]nvalid skill name/);
    });

    it('accepts valid kebab-case names', async () => {
      await fs.writeFile(
        join(dir, 'valid-name.md'),
        ['# Valid', '', 'Valid skill.', '', '## Steps', '', '1. Step', ''].join('\n'),
      );
      const skill = await parser.resolve('valid-name');
      expect(skill.name).toBe('valid-name');
    });
  });

  // --- Inline tags ---
  describe('inline tags', () => {
    it('parses Tags: line into metadata', async () => {
      await fs.writeFile(
        join(dir, 'tagged.md'),
        [
          '# Tagged',
          '',
          'A tagged skill.',
          '',
          'Tags: review, quality, testing',
          '',
          '## Steps',
          '',
          '1. Step',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('tagged');
      expect(skill.metadata).toBeUndefined();
    });

    it('merges inline tags into frontmatter metadata without tags', async () => {
      await fs.writeFile(
        join(dir, 'fm-tagged.md'),
        [
          '---',
          'name: fm-tagged',
          'version: 1.0.0',
          '---',
          '',
          '# FM Tagged',
          '',
          'A skill with frontmatter but no tags.',
          '',
          'Tags: alpha, beta',
          '',
          '## Steps',
          '',
          '1. Step',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('fm-tagged');
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata!.tags).toEqual(['alpha', 'beta']);
    });
  });

  // --- Sections: prerequisites, notes, success criteria, related skills ---
  describe('extra sections', () => {
    it('parses prerequisites, notes, success criteria, related skills', async () => {
      await fs.writeFile(
        join(dir, 'full-skill.md'),
        [
          '# Full Skill',
          '',
          'A complete skill.',
          '',
          '## Prerequisites',
          '',
          '- Know TypeScript',
          '- Have Node installed',
          '',
          '## Steps',
          '',
          '1. Do work',
          '',
          '## Notes',
          '',
          '- Tip 1: Be careful',
          '- Tip 2: Test often',
          '',
          '## Success Criteria',
          '',
          '- All tests pass',
          '- No regressions',
          '',
          '## Related Skills',
          '',
          '- testing: Run tests',
          '- code-review: Review code',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('full-skill');
      expect(skill.prerequisites).toEqual(['Know TypeScript', 'Have Node installed']);
      expect(skill.notes).toHaveLength(2);
      expect(skill.successCriteria).toEqual(['All tests pass', 'No regressions']);
      expect(skill.relatedSkills).toHaveLength(2);
    });
  });

  // --- Context section ---
  describe('context section', () => {
    it('extracts context section', async () => {
      await fs.writeFile(
        join(dir, 'ctx-skill.md'),
        [
          '# Ctx Skill',
          '',
          'Context test.',
          '',
          '## Context',
          '',
          'Skills are structured protocols.',
          '',
          '## Steps',
          '',
          '1. Step',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('ctx-skill');
      expect(skill.context).toBe('Skills are structured protocols.');
    });
  });

  // --- Flat file layout ---
  describe('file layout', () => {
    it('finds flat .md files', async () => {
      await fs.writeFile(
        join(dir, 'flat-skill.md'),
        ['# Flat', '', 'Flat layout.', '', '## Steps', '', '1. Step', ''].join('\n'),
      );
      const skill = await parser.resolve('flat-skill');
      expect(skill.name).toBe('flat-skill');
    });

    it('prefers directory layout over flat', async () => {
      await fs.mkdir(join(dir, 'dual-skill'), { recursive: true });
      await fs.writeFile(
        join(dir, 'dual-skill', 'protocol.md'),
        ['# Dir Version', '', 'From directory.', '', '## Steps', '', '1. Step', ''].join('\n'),
      );
      await fs.writeFile(
        join(dir, 'dual-skill.md'),
        ['# Flat Version', '', 'From flat.', '', '## Steps', '', '1. Step', ''].join('\n'),
      );
      const skill = await parser.resolve('dual-skill');
      expect(skill.description).toBe('From directory.');
    });

    it('lists both directories and flat files', async () => {
      await fs.mkdir(join(dir, 'dir-skill'), { recursive: true });
      await fs.writeFile(join(dir, 'flat-list.md'), '# F\n\nDesc.\n\n## Steps\n\n1. S\n');
      const skills = await parser.list();
      expect(skills).toContain('dir-skill');
      expect(skills).toContain('flat-list');
    });
  });

  it('returns empty list for missing dir', async () => {
    const p = new SkillParser('/nonexistent');
    expect(await p.list()).toEqual([]);
  });

  it('list rethrows non-ENOENT errors', async () => {
    // Point parser at a file instead of a directory
    const filePath = join(dir, 'afile.txt');
    await fs.writeFile(filePath, 'data');
    const p = new SkillParser(filePath);
    await expect(p.list()).rejects.toThrow();
  });

  it('findSkillFile rethrows non-ENOENT on flat path access', async () => {
    // Spy on fs.access to throw EACCES for the flat path
    const origAccess = fs.access;
    const spy = vi.spyOn(fs, 'access').mockImplementation(async (path: any, ...args: any[]) => {
      const pathStr = String(path);
      if (pathStr.endsWith('perm-err/protocol.md')) {
        // Dir-based path: throw ENOENT (normal)
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        throw err;
      }
      if (pathStr.endsWith('perm-err.md')) {
        // Flat path: throw EACCES (non-ENOENT)
        const err = Object.assign(new Error('EACCES'), { code: 'EACCES' });
        throw err;
      }
      return origAccess.call(fs, path, ...args);
    });

    await expect(parser.resolve('perm-err')).rejects.toThrow();
    spy.mockRestore();
  });


  describe('Format C annotation in body', () => {
    it('appends non-annotation body text to description', async () => {
      await fs.mkdir(join(dir, 'fc-body'), { recursive: true });
      await fs.writeFile(
        join(dir, 'fc-body', 'protocol.md'),
        [
          '# FC Body',
          '',
          'Format C body test.',
          '',
          '## Steps',
          '',
          '### 1. Setup',
          'First line of description.',
          'Second line of description.',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('fc-body');
      expect(skill.steps[0].description).toContain('First line');
      expect(skill.steps[0].description).toContain('Second line');
    });
  });

  describe('extractDescription edge cases', () => {
    it('returns empty string when body has only headings', async () => {
      // All non-empty lines are headings, so extractDescription returns ''
      await fs.writeFile(
        join(dir, 'heading-only.md'),
        [
          '# Heading Only',
          '',
          '## Steps',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('heading-only');
      expect(skill.description).toBe('');
    });

    it('skips Tags: line as first non-heading content', async () => {
      await fs.writeFile(
        join(dir, 'tags-first.md'),
        [
          '# Tags First',
          '',
          'Tags: foo, bar',
          '',
          'Actual description after tags.',
          '',
          '## Steps',
          '',
          '1. Step',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('tags-first');
      expect(skill.description).toBe('Actual description after tags.');
    });

    it('skips @import line as first non-heading content', async () => {
      await fs.mkdir(join(dir, 'base-imp'), { recursive: true });
      await fs.writeFile(
        join(dir, 'base-imp', 'protocol.md'),
        ['# Base', '', 'Base.', '', '## Steps', '', '1. S', ''].join('\n'),
      );
      await fs.writeFile(
        join(dir, 'import-first.md'),
        [
          '# Import First',
          '',
          '@import base-imp',
          '',
          'Description after import.',
          '',
          '## Steps',
          '',
          '1. Step',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('import-first');
      expect(skill.description).toBe('Description after import.');
    });
  });

  describe('Format B annotation sub-item with text', () => {
    it('appends stripped annotation sub-item text to description', async () => {
      await fs.mkdir(join(dir, 'annot-text'), { recursive: true });
      await fs.writeFile(
        join(dir, 'annot-text', 'protocol.md'),
        [
          '# Annot Text',
          '',
          'Annotation text test.',
          '',
          '## Steps',
          '',
          '1. **Setup**: Configure',
          '   - Important note [independent]',
          '',
        ].join('\n'),
      );
      const skill = await parser.resolve('annot-text');
      expect(skill.steps).toHaveLength(1);
      expect(skill.steps[0].annotations).toContainEqual({ type: 'independent' });
      expect(skill.steps[0].description).toContain('Important note');
    });
  });
});
