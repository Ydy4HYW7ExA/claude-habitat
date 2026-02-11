import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Container } from '../../src/di/container.js';
import { Tokens } from '../../src/di/tokens.js';
import { SkillParser } from '../../src/domain/skill/parser.js';
import { SessionTracker } from '../../src/domain/session/tracker.js';
import { Logger } from '../../src/logging/logger.js';
import { registerSkillTools } from '../../src/mcp/tools/skill.js';
import type { ToolMetadata } from '../../src/mcp/define-tool.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('skill tools', () => {
  let dir: string;
  let tools: ToolMetadata[];

  beforeEach(async () => {
    dir = join(tmpdir(), `skill-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(dir, { recursive: true });

    // Write a test skill file
    await fs.writeFile(
      join(dir, 'test-skill.md'),
      '# Test Skill\n\nA test skill for unit testing.\n\n## Steps\n\n1. Do something\n2. Do another thing\n',
    );

    const container = new Container();
    container.register(Tokens.SkillParser, () => new SkillParser(dir));
    container.register(Tokens.SessionTracker, () =>
      new SessionTracker(new Logger({ level: 'error' })),
    );
    tools = registerSkillTools(container);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  function findTool(name: string): ToolMetadata {
    const t = tools.find((t) => t.name === name);
    if (!t) throw new Error(`Tool not found: ${name}`);
    return t;
  }

  it('habitat_skill_resolve parses a skill file', async () => {
    const tool = findTool('habitat_skill_resolve');
    const result = await tool.execute({ skillName: 'test-skill' });
    expect(result.success).toBe(true);
    expect((result.data as any).name).toBe('test-skill');
    expect((result.data as any).steps.length).toBeGreaterThan(0);
  });

  it('habitat_skill_resolve with resolveImports=false', async () => {
    const tool = findTool('habitat_skill_resolve');
    const result = await tool.execute({ skillName: 'test-skill', resolveImports: false });
    expect(result.success).toBe(true);
    expect((result.data as any).name).toBe('test-skill');
  });

  it('habitat_skill_resolve returns error for nonexistent skill', async () => {
    const tool = findTool('habitat_skill_resolve');
    const result = await tool.execute({ skillName: 'nonexistent-skill' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
