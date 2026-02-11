import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { generateClaudeMd } from '../../src/preset/claude-md-generator.js';
import { RULE_WORKFLOW_ID, SKILL_PROJECT_ITERATE } from '../../src/preset/constants.js';

function tmpDir(): string {
  return join(tmpdir(), `ch-test-${randomBytes(6).toString('hex')}`);
}

describe('generateClaudeMd', () => {
  let presetsDir: string;

  beforeEach(async () => {
    presetsDir = tmpDir();
    await fs.mkdir(join(presetsDir, 'rules'), { recursive: true });
    await fs.mkdir(join(presetsDir, 'skills'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(presetsDir, { recursive: true, force: true });
  });

  it('does not include old managed marker', async () => {
    const md = await generateClaudeMd(presetsDir);
    expect(md).not.toContain('<!-- claude-habitat-managed -->');
  });

  it('handles empty directories', async () => {
    const md = await generateClaudeMd(presetsDir);
    expect(md).toContain('# Claude Habitat Rules');
    expect(md).toContain('auto-generated');
  });

  it('generates skills section from .md files', async () => {
    await fs.writeFile(
      join(presetsDir, 'skills', 'code-review.md'),
      '# Code Review\n\nA structured protocol for reviews.\n\nTags: review\n',
    );
    await fs.writeFile(
      join(presetsDir, 'skills', 'refactor.md'),
      '# Refactor\n\nImprove code structure.\n\nTags: refactor\n',
    );

    const md = await generateClaudeMd(presetsDir);

    expect(md).toContain('## Available Skills');
    expect(md).toContain('**code-review**');
    expect(md).toContain('**refactor**');
    expect(md).toContain('habitat_skill_resolve');
  });

  it('generates rules section with habitat_skill_resolve directives', async () => {
    const rule = {
      id: RULE_WORKFLOW_ID,
      name: 'Workflow Execution Protocol',
      description: 'Enforces the project-iterate workflow',
      priority: 'critical',
      content: '### Workflow Execution Protocol (MANDATORY)\n\nALWAYS call `habitat_workflow_status` first.',
    };
    await fs.writeFile(
      join(presetsDir, 'rules', `${RULE_WORKFLOW_ID}.json`),
      JSON.stringify(rule),
    );

    const md = await generateClaudeMd(presetsDir);

    expect(md).toContain('## Rules');
    expect(md).toContain('### Workflow Execution Protocol (MANDATORY)');
    expect(md).toContain(`habitat_skill_resolve("${SKILL_PROJECT_ITERATE}")`);
    expect(md).toContain('**REQUIRED:**');
  });

  it('sorts rules by priority', async () => {
    const low = {
      id: 'rule-documentation',
      name: 'Docs',
      priority: 'medium',
      content: '## Docs\n\nWrite docs.',
    };
    const high = {
      id: 'rule-security',
      name: 'Security',
      priority: 'critical',
      content: '## Security\n\nBe secure.',
    };
    await fs.writeFile(
      join(presetsDir, 'rules', 'docs.json'),
      JSON.stringify(low),
    );
    await fs.writeFile(
      join(presetsDir, 'rules', 'security.json'),
      JSON.stringify(high),
    );

    const md = await generateClaudeMd(presetsDir);
    const secIdx = md.indexOf('## Security');
    const docIdx = md.indexOf('## Docs');
    expect(secIdx).toBeLessThan(docIdx);
  });

  it('includes workflow section when rule-workflow exists', async () => {
    const rule = {
      id: RULE_WORKFLOW_ID,
      name: 'Workflow Execution Protocol',
      description: 'Enforces the project-iterate workflow',
      priority: 'critical',
      content: '### Workflow Execution Protocol (MANDATORY)\n\nALWAYS call `habitat_workflow_status` first.',
    };
    await fs.writeFile(
      join(presetsDir, 'rules', `${RULE_WORKFLOW_ID}.json`),
      JSON.stringify(rule),
    );

    const md = await generateClaudeMd(presetsDir);
    expect(md).toContain('### Workflow Execution Protocol (MANDATORY)');
    expect(md).toContain('habitat_workflow_status');
  });

  it('extracts description from YAML frontmatter', async () => {
    const skill = [
      '---',
      'name: testing',
      'description: Comprehensive testing protocol',
      '---',
      '# Testing',
      '',
      'Body text here.',
    ].join('\n');
    await fs.writeFile(join(presetsDir, 'skills', 'testing.md'), skill);

    const md = await generateClaudeMd(presetsDir);
    expect(md).toContain('**testing** — Comprehensive testing protocol');
  });

  it('extracts description from **Description** field after heading', async () => {
    const skill = [
      '# Skill Name',
      '',
      '## Overview',
      '**Description**: A detailed description here',
      '',
    ].join('\n');
    await fs.writeFile(join(presetsDir, 'skills', 'desc-field.md'), skill);

    const md = await generateClaudeMd(presetsDir);
    expect(md).toContain('**desc-field** — A detailed description here');
  });

  it('returns empty description when only headings exist', async () => {
    const skill = [
      '# Skill',
      '',
      '## Section One',
      '## Section Two',
      '',
    ].join('\n');
    await fs.writeFile(join(presetsDir, 'skills', 'no-desc.md'), skill);

    const md = await generateClaudeMd(presetsDir);
    // Skill should appear but with no description suffix
    expect(md).toContain('**no-desc**');
  });

  it('returns empty description for content with only empty lines', async () => {
    const skill = '\n\n\n';
    await fs.writeFile(join(presetsDir, 'skills', 'empty-skill.md'), skill);

    const md = await generateClaudeMd(presetsDir);
    expect(md).toContain('**empty-skill**');
  });

  it('skips invalid JSON rule files gracefully', async () => {
    await fs.writeFile(join(presetsDir, 'rules', 'bad.json'), 'not valid json{{{');
    await fs.writeFile(
      join(presetsDir, 'rules', 'good.json'),
      JSON.stringify({ id: 'r1', name: 'Good', priority: 'low', content: '## Good Rule' }),
    );
    const md = await generateClaudeMd(presetsDir);
    expect(md).toContain('## Good Rule');
  });

  it('sorts rules with unknown priority using fallback', async () => {
    await fs.writeFile(
      join(presetsDir, 'rules', 'unknown.json'),
      JSON.stringify({ id: 'r-unk', name: 'Unknown', priority: 'exotic', content: '## Exotic Rule' }),
    );
    await fs.writeFile(
      join(presetsDir, 'rules', 'critical.json'),
      JSON.stringify({ id: 'r-crit', name: 'Critical', priority: 'critical', content: '## Critical Rule' }),
    );
    const md = await generateClaudeMd(presetsDir);
    const critIdx = md.indexOf('## Critical Rule');
    const unkIdx = md.indexOf('## Exotic Rule');
    expect(critIdx).toBeLessThan(unkIdx);
  });

  it('sorts two rules both with unknown priorities via fallback', async () => {
    await fs.writeFile(
      join(presetsDir, 'rules', 'alpha.json'),
      JSON.stringify({ id: 'r-a', name: 'Alpha', priority: 'alien', content: '## Alpha Rule' }),
    );
    await fs.writeFile(
      join(presetsDir, 'rules', 'beta.json'),
      JSON.stringify({ id: 'r-b', name: 'Beta', priority: 'bizarre', content: '## Beta Rule' }),
    );
    const md = await generateClaudeMd(presetsDir);
    // Both unknown priorities fall back to 99, so both should appear
    expect(md).toContain('## Alpha Rule');
    expect(md).toContain('## Beta Rule');
  });

  it('extracts description skipping Tags: line', async () => {
    const skill = [
      '# Skill With Tags',
      '',
      'Tags: foo, bar',
      'The actual description.',
      '',
    ].join('\n');
    await fs.writeFile(join(presetsDir, 'skills', 'tags-first.md'), skill);
    const md = await generateClaudeMd(presetsDir);
    expect(md).toContain('**tags-first** — The actual description.');
  });

  it('handles missing presets directories gracefully', async () => {
    const emptyDir = join(presetsDir, 'nonexistent');
    const md = await generateClaudeMd(emptyDir);
    expect(md).toContain('# Claude Habitat Rules');
  });
});