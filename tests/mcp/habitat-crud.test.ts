import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { Container } from '../../src/di/container.js';
import { Tokens } from '../../src/di/tokens.js';
import { Logger } from '../../src/logging/logger.js';
import { HabitatFileService } from '../../src/domain/habitat-files/service.js';
import { registerHabitatCommandTools } from '../../src/mcp/tools/habitat-command.js';
import { registerHabitatSkillTools } from '../../src/mcp/tools/habitat-skill.js';
import { registerHabitatRuleTools } from '../../src/mcp/tools/habitat-rule.js';
import type { ToolMetadata } from '../../src/mcp/define-tool.js';

function tmpDir(): string {
  return join(tmpdir(), `ch-crud-${randomBytes(6).toString('hex')}`);
}

function findTool(tools: ToolMetadata[], name: string): ToolMetadata {
  const t = tools.find((t) => t.name === name);
  if (!t) throw new Error(`Tool not found: ${name}`);
  return t;
}

describe('Habitat CRUD MCP Tools', () => {
  let habitatDir: string;
  let claudeDir: string;
  let container: Container;
  let cmdTools: ToolMetadata[];
  let skillTools: ToolMetadata[];
  let ruleTools: ToolMetadata[];

  beforeEach(async () => {
    habitatDir = tmpDir();
    claudeDir = tmpDir();
    await fs.mkdir(habitatDir, { recursive: true });
    await fs.mkdir(claudeDir, { recursive: true });

    const logger = new Logger({ level: 'error' });
    container = new Container();
    container.register(Tokens.HabitatFileService, () =>
      new HabitatFileService(habitatDir, claudeDir, logger),
    );

    cmdTools = registerHabitatCommandTools(container);
    skillTools = registerHabitatSkillTools(container);
    ruleTools = registerHabitatRuleTools(container);
  });

  afterEach(async () => {
    await fs.rm(habitatDir, { recursive: true, force: true });
    await fs.rm(claudeDir, { recursive: true, force: true });
  });

  describe('command tools', () => {
    it('habitat_command_create + habitat_command_read roundtrip', async () => {
      const create = findTool(cmdTools, 'habitat_command_create');
      const read = findTool(cmdTools, 'habitat_command_read');

      const cr = await create.execute({
        name: 'habitat-hello', content: '# Hello', scope: 'global',
      });
      expect(cr.success).toBe(true);
      expect((cr.data as any).name).toBe('habitat-hello');

      const rd = await read.execute({ name: 'habitat-hello', scope: 'global' });
      expect(rd.success).toBe(true);
      expect((rd.data as any).content).toBe('# Hello');
    });

    it('habitat_command_list returns created commands', async () => {
      const create = findTool(cmdTools, 'habitat_command_create');
      const list = findTool(cmdTools, 'habitat_command_list');

      await create.execute({ name: 'habitat-one', content: '1', scope: 'global' });
      await create.execute({ name: 'habitat-two', content: '2', scope: 'global' });

      const result = await list.execute({ scope: 'global' });
      expect(result.success).toBe(true);
      expect((result.data as any[]).length).toBe(2);
    });

    it('habitat_command_update updates content', async () => {
      const create = findTool(cmdTools, 'habitat_command_create');
      const update = findTool(cmdTools, 'habitat_command_update');
      const read = findTool(cmdTools, 'habitat_command_read');

      await create.execute({ name: 'habitat-upd', content: 'old', scope: 'global' });
      await update.execute({ name: 'habitat-upd', content: 'new', scope: 'global' });

      const rd = await read.execute({ name: 'habitat-upd', scope: 'global' });
      expect((rd.data as any).content).toBe('new');
    });

    it('habitat_command_delete removes command', async () => {
      const create = findTool(cmdTools, 'habitat_command_create');
      const del = findTool(cmdTools, 'habitat_command_delete');
      const read = findTool(cmdTools, 'habitat_command_read');

      await create.execute({ name: 'habitat-del', content: 'bye', scope: 'global' });
      const delResult = await del.execute({ name: 'habitat-del', scope: 'global' });
      expect(delResult.success).toBe(true);

      const rd = await read.execute({ name: 'habitat-del', scope: 'global' });
      expect(rd.success).toBe(false);
      expect(rd.error).toContain('not found');
    });
  });

  describe('rule tools', () => {
    it('habitat_rule_create + habitat_rule_read roundtrip', async () => {
      const create = findTool(ruleTools, 'habitat_rule_create');
      const read = findTool(ruleTools, 'habitat_rule_read');

      const ruleContent = JSON.stringify({
        id: 'habitat-myrule', name: 'My Rule', priority: 'low', content: '## My Rule',
      });
      const cr = await create.execute({
        name: 'habitat-myrule', content: ruleContent, scope: 'global',
      });
      expect(cr.success).toBe(true);

      const rd = await read.execute({ name: 'habitat-myrule', scope: 'global' });
      expect(rd.success).toBe(true);
      expect((rd.data as any).content).toBe(ruleContent);
    });

    it('habitat_rule_delete removes rule', async () => {
      const create = findTool(ruleTools, 'habitat_rule_create');
      const del = findTool(ruleTools, 'habitat_rule_delete');
      const read = findTool(ruleTools, 'habitat_rule_read');

      const ruleContent = JSON.stringify({
        id: 'habitat-delrule', name: 'Del Rule', priority: 'low', content: '## Del',
      });
      await create.execute({ name: 'habitat-delrule', content: ruleContent, scope: 'global' });

      const delResult = await del.execute({ name: 'habitat-delrule', scope: 'global' });
      expect(delResult.success).toBe(true);

      const rd = await read.execute({ name: 'habitat-delrule', scope: 'global' });
      expect(rd.success).toBe(false);
    });
  });

  describe('validation', () => {
    it('rejects invalid scope via schema validation', async () => {
      const create = findTool(cmdTools, 'habitat_command_create');
      const result = await create.execute({
        name: 'habitat-bad', content: 'x', scope: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('skill tools', () => {
    it('habitat_skill_create + habitat_skill_list roundtrip', async () => {
      const create = findTool(skillTools, 'habitat_skill_create');
      const list = findTool(skillTools, 'habitat_skill_list');

      await create.execute({ name: 'habitat-review', content: '# Review', scope: 'global' });

      const result = await list.execute({ scope: 'global' });
      expect(result.success).toBe(true);
      expect((result.data as any[]).length).toBe(1);
      expect((result.data as any[])[0].name).toBe('habitat-review');
    });
  });
});