import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Container } from '../../src/di/container.js';
import type { ToolMetadata } from '../../src/mcp/define-tool.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// We need to mock constants so habitat_project_init uses our temp dirs
let mockHabitatSkillsDir: string;
let mockHabitatCommandsDir: string;
let mockHabitatRulesDir: string;
let mockHabitatDir: string;

vi.mock('../../src/preset/constants.js', () => ({
  get HABITAT_DIR() { return mockHabitatDir; },
  get HABITAT_SKILLS_DIR() { return mockHabitatSkillsDir; },
  get HABITAT_COMMANDS_DIR() { return mockHabitatCommandsDir; },
  get HABITAT_RULES_DIR() { return mockHabitatRulesDir; },
  HABITAT_BEGIN_MARKER: '<!-- habitat-begin -->',
  HABITAT_END_MARKER: '<!-- habitat-end -->',
  CLAUDE_MD_MARKER: '<!-- claude-habitat-managed -->',
  RULE_SKILL_MAP: {},
}));

// Import after mock setup
const { registerProjectTools } = await import('../../src/mcp/tools/project.js');

describe('project tools', () => {
  let dir: string;
  let tools: ToolMetadata[];
  let srcDir: string;

  beforeEach(async () => {
    dir = join(tmpdir(), `proj-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    srcDir = join(tmpdir(), `proj-src-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(dir, { recursive: true });

    // Set up global habitat source dirs with test files
    mockHabitatSkillsDir = join(srcDir, 'skills');
    mockHabitatCommandsDir = join(srcDir, 'commands');
    mockHabitatRulesDir = join(srcDir, 'rules');
    mockHabitatDir = srcDir;

    await fs.mkdir(mockHabitatSkillsDir, { recursive: true });
    await fs.mkdir(mockHabitatCommandsDir, { recursive: true });
    await fs.mkdir(mockHabitatRulesDir, { recursive: true });
    await fs.writeFile(join(mockHabitatSkillsDir, 'habitat-test-skill.md'), '# Test Skill');
    await fs.writeFile(join(mockHabitatSkillsDir, 'ignore.txt'), 'not an md');
    await fs.writeFile(join(mockHabitatCommandsDir, 'habitat-test-cmd.md'), '# Test Cmd');

    const container = new Container();
    tools = registerProjectTools(container);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rm(srcDir, { recursive: true, force: true });
  });

  function findTool(name: string): ToolMetadata {
    const t = tools.find((t) => t.name === name);
    if (!t) throw new Error(`Tool not found: ${name}`);
    return t;
  }

  describe('habitat_project_init', () => {
    it('creates directory structure and marker.json', async () => {
      const tool = findTool('habitat_project_init');
      const result = await tool.execute({ projectPath: dir });
      expect(result.success).toBe(true);

      const data = result.data as any;
      expect(data.projectId).toBeDefined();
      expect(data.habitatDir).toBe(join(dir, '.claude-habitat'));

      const marker = JSON.parse(
        await fs.readFile(join(dir, '.claude-habitat', 'marker.json'), 'utf-8'),
      );
      expect(marker.projectId).toBe(data.projectId);
      expect(marker.version).toBe('1.0.0');
    });

    it('uses provided projectName', async () => {
      const tool = findTool('habitat_project_init');
      const result = await tool.execute({ projectPath: dir, projectName: 'my-proj' });
      expect((result.data as any).projectName).toBe('my-proj');
    });
  });

  describe('symlink-based habitat_project_init', () => {
    it('copies files to project habitat and creates symlinks', async () => {
      const tool = findTool('habitat_project_init');
      await tool.execute({ projectPath: dir });

      // Files should be in project habitat dirs
      const projHabitatSkills = join(dir, '.claude-habitat', 'skills');
      const skillFiles = await fs.readdir(projHabitatSkills);
      expect(skillFiles).toContain('habitat-test-skill.md');

      // Symlinks should exist in .claude/
      const projClaudeSkills = join(dir, '.claude', 'skills');
      const symlinkFiles = await fs.readdir(projClaudeSkills);
      expect(symlinkFiles).toContain('habitat-test-skill.md');

      // Verify it's a symlink
      const stat = await fs.lstat(join(projClaudeSkills, 'habitat-test-skill.md'));
      expect(stat.isSymbolicLink()).toBe(true);
    });

    it('injects CLAUDE.md with habitat markers', async () => {
      const tool = findTool('habitat_project_init');
      await tool.execute({ projectPath: dir });

      const claudeMd = await fs.readFile(join(dir, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toContain('<!-- habitat-begin -->');
      expect(claudeMd).toContain('<!-- habitat-end -->');
      expect(claudeMd).toContain('# Claude Habitat Rules');
    });

    it('appends to existing user CLAUDE.md', async () => {
      await fs.writeFile(join(dir, 'CLAUDE.md'), '# My Custom Rules\n');

      const tool = findTool('habitat_project_init');
      await tool.execute({ projectPath: dir });

      const claudeMd = await fs.readFile(join(dir, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toContain('# My Custom Rules');
      expect(claudeMd).toContain('<!-- habitat-begin -->');
    });
  });

  describe('habitat_project_info error handling', () => {
    it('rethrows non-ENOENT errors', async () => {
      const habitatDir = join(dir, '.claude-habitat');
      await fs.mkdir(habitatDir, { recursive: true });
      await fs.mkdir(join(habitatDir, 'marker.json'), { recursive: true });

      const info = findTool('habitat_project_info');
      const result = await info.execute({ projectPath: dir });
      expect(result.success).toBe(false);
    });
  });

  describe('habitat_project_init .gitignore handling', () => {
    it('creates .gitignore with .claude-habitat/ entry', async () => {
      const tool = findTool('habitat_project_init');
      await tool.execute({ projectPath: dir });

      const content = await fs.readFile(join(dir, '.gitignore'), 'utf-8');
      expect(content).toContain('.claude-habitat/');
    });

    it('appends to existing .gitignore without duplicating', async () => {
      await fs.writeFile(join(dir, '.gitignore'), 'node_modules/\n');

      const tool = findTool('habitat_project_init');
      await tool.execute({ projectPath: dir });

      const content = await fs.readFile(join(dir, '.gitignore'), 'utf-8');
      expect(content).toContain('node_modules/');
      expect(content).toContain('.claude-habitat/');
    });

    it('does not duplicate if already present', async () => {
      await fs.writeFile(join(dir, '.gitignore'), '.claude-habitat/\n');

      const tool = findTool('habitat_project_init');
      await tool.execute({ projectPath: dir });

      const content = await fs.readFile(join(dir, '.gitignore'), 'utf-8');
      const matches = content.match(/\.claude-habitat\//g);
      expect(matches).toHaveLength(1);
    });

    it('handles .gitignore without trailing newline', async () => {
      await fs.writeFile(join(dir, '.gitignore'), 'node_modules/');

      const tool = findTool('habitat_project_init');
      await tool.execute({ projectPath: dir });

      const content = await fs.readFile(join(dir, '.gitignore'), 'utf-8');
      expect(content).toBe('node_modules/\n.claude-habitat/\n');
    });
  });

  describe('habitat_project_init configSources', () => {
    it('returns configSources in result', async () => {
      const tool = findTool('habitat_project_init');
      const result = await tool.execute({ projectPath: dir });
      const data = result.data as any;

      expect(data.configSources).toBeDefined();
      expect(typeof data.configSources.globalConfigExists).toBe('boolean');
      expect(typeof data.configSources.globalHasApiKey).toBe('boolean');
      expect(typeof data.configSources.envHasAuthToken).toBe('boolean');
    });
  });

  describe('habitat_project_configure', () => {
    it('returns global source when useGlobalConfig is true', async () => {
      const tool = findTool('habitat_project_configure');
      const result = await tool.execute({ projectPath: dir, useGlobalConfig: true });
      const data = result.data as any;

      expect(data.configured).toBe(true);
      expect(data.source).toBe('global');
    });

    it('writes project config with apiKey', async () => {
      await fs.mkdir(join(dir, '.claude-habitat'), { recursive: true });

      const tool = findTool('habitat_project_configure');
      const result = await tool.execute({ projectPath: dir, apiKey: 'test-key' });
      const data = result.data as any;

      expect(data.configured).toBe(true);
      expect(data.source).toBe('project');
      expect(data.enabled).toBe(true);

      const config = JSON.parse(
        await fs.readFile(join(dir, '.claude-habitat', 'config.json'), 'utf-8'),
      );
      expect(config.promptAugmentor.apiKey).toBe('test-key');
      expect(config.skillMatcher.apiKey).toBe('test-key');
    });

    it('disables augmentation when no apiKey provided', async () => {
      const tool = findTool('habitat_project_configure');
      const result = await tool.execute({ projectPath: dir });
      const data = result.data as any;

      expect(data.enabled).toBe(false);

      const config = JSON.parse(
        await fs.readFile(join(dir, '.claude-habitat', 'config.json'), 'utf-8'),
      );
      expect(config.promptAugmentor.enabled).toBe(false);
    });

    it('respects explicit enabled flag', async () => {
      const tool = findTool('habitat_project_configure');
      await tool.execute({ projectPath: dir, enabled: true });

      const config = JSON.parse(
        await fs.readFile(join(dir, '.claude-habitat', 'config.json'), 'utf-8'),
      );
      expect(config.promptAugmentor.enabled).toBe(true);
    });
  });
});