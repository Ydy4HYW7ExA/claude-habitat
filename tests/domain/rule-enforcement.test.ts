import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRuleEnforcementHook } from '../../src/domain/hook/rule-enforcement.js';
import { RuleEngine } from '../../src/domain/rule/engine.js';
import { SkillMatcher } from '../../src/domain/skill-matcher/matcher.js';
import { SessionTracker } from '../../src/domain/session/tracker.js';
import { Logger } from '../../src/logging/logger.js';
import type { HookContext } from '../../src/domain/hook/types.js';
import { SKILL_PROJECT_ITERATE } from '../../src/preset/constants.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const logger = new Logger({ level: 'error' });

function makeDeps(overrides?: Partial<ReturnType<typeof defaultDeps>>) {
  return { ...defaultDeps(), ...overrides };
}

function defaultDeps() {
  const ruleEngine = new RuleEngine(logger);
  const skillMatcher = new SkillMatcher({ enabled: false }, logger);
  const sessionTracker = new SessionTracker(logger);
  return { ruleEngine, skillMatcher, sessionTracker, skillsDir: '/tmp/nonexistent', logger };
}

describe('RuleEnforcementHook', () => {
  it('records tool call on every invocation', async () => {
    const deps = makeDeps();
    const hook = createRuleEnforcementHook(deps);
    const ctx: HookContext = { event: 'after:tool', toolName: 'habitat_doc_create', data: {} };
    await hook.handler(ctx);
    expect(deps.sessionTracker.getStats().totalToolCalls).toBe(1);
  });

  it('skips tools in the skip list', async () => {
    const deps = makeDeps();
    deps.ruleEngine.register({
      id: 'r1', name: 'Test', description: 'test',
      pattern: '.*', action: 'warn', category: 'general', enabled: true,
    });
    const hook = createRuleEnforcementHook(deps);

    const ctx: HookContext = { event: 'after:tool', toolName: 'habitat_skill_resolve', data: {} };
    await hook.handler(ctx);
    expect(ctx.data?.hints).toBeUndefined();
  });

  it('injects hints when rules match', async () => {
    const deps = makeDeps();
    deps.ruleEngine.register({
      id: 'r1', name: 'Test Rule', description: 'A test rule',
      pattern: '.*', action: 'warn', category: 'general', enabled: true,
    });
    const hook = createRuleEnforcementHook(deps);

    const ctx: HookContext = { event: 'after:tool', toolName: 'habitat_doc_create', data: {} };
    await hook.handler(ctx);

    expect(ctx.data?.hints).toBeDefined();
    expect(ctx.data!.hints as string).toContain('Test Rule');
  });

  it('does not inject hints when no rules match', async () => {
    const deps = makeDeps();
    // Register a rule that won't match
    deps.ruleEngine.register({
      id: 'r1', name: 'Specific', description: 'Only matches xyz',
      pattern: 'xyz_specific_pattern', action: 'warn', category: 'general', enabled: true,
    });
    const hook = createRuleEnforcementHook(deps);

    const ctx: HookContext = { event: 'after:tool', toolName: 'habitat_doc_create', data: { input: { title: 'hello' } } };
    await hook.handler(ctx);

    expect(ctx.data?.hints).toBeUndefined();
  });

  it('records rule triggers in SessionTracker', async () => {
    const deps = makeDeps();
    deps.ruleEngine.register({
      id: 'r1', name: 'Test Rule', description: 'test',
      pattern: '.*', action: 'suggest', category: 'general', enabled: true,
    });
    const hook = createRuleEnforcementHook(deps);

    const ctx: HookContext = { event: 'after:tool', toolName: 'habitat_doc_create', data: {} };
    await hook.handler(ctx);

    const stats = deps.sessionTracker.getStats();
    expect(stats.ruleTriggers.get('r1')).toBe(1);
  });

  it('includes habitat_skill_resolve guidance when SkillMatcher returns results', async () => {
    // Create a temp skills dir with a skill file so getAvailableSkills finds it
    const tmpSkillsDir = join(tmpdir(), `re-test-${Date.now()}`);
    await fs.mkdir(tmpSkillsDir, { recursive: true });
    await fs.writeFile(
      join(tmpSkillsDir, `${SKILL_PROJECT_ITERATE}.md`),
      `---\nname: ${SKILL_PROJECT_ITERATE}\ndescription: "Workflow protocol"\ntags: [workflow]\n---\n# ${SKILL_PROJECT_ITERATE}\n`,
    );

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({
        content: [{ type: 'text', text: `[{"skillName":"${SKILL_PROJECT_ITERATE}","confidence":0.9,"reasoning":"match"}]` }],
      }), { status: 200 }),
    );

    const deps = defaultDeps();
    deps.skillMatcher = new SkillMatcher({ enabled: true, apiKey: 'test' }, logger);
    deps.skillsDir = tmpSkillsDir;
    deps.ruleEngine.register({
      id: 'r1', name: 'Workflow', description: 'workflow rule',
      pattern: '.*', action: 'warn', category: 'workflow',
      enabled: true, tags: ['workflow'],
    });
    const hook = createRuleEnforcementHook(deps);

    const ctx: HookContext = { event: 'after:tool', toolName: 'habitat_doc_create', data: {} };
    await hook.handler(ctx);

    expect(ctx.data?.hints).toBeDefined();
    const hints = ctx.data!.hints as string;
    expect(hints).toContain(`habitat_skill_resolve("${SKILL_PROJECT_ITERATE}")`);

    fetchSpy.mockRestore();
    await fs.rm(tmpSkillsDir, { recursive: true, force: true });
  });

  it('calls discoverSkills as fallback when rules match but no skills found', async () => {
    const tmpSkillsDir = join(tmpdir(), `re-discover-${Date.now()}`);
    await fs.mkdir(tmpSkillsDir, { recursive: true });
    await fs.writeFile(
      join(tmpSkillsDir, 'code-review.md'),
      '---\nname: code-review\ndescription: "Code review protocol"\ntags: [review]\n---\n# code-review\n',
    );

    // First call returns empty (matchRule), second returns discovery result
    let callCount = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // matchRule returns no skills
        return new Response(JSON.stringify({
          content: [{ type: 'text', text: '[]' }],
        }), { status: 200 });
      }
      // discoverSkills returns a match
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: '[{"skillName":"code-review","confidence":0.8,"reasoning":"context match"}]' }],
      }), { status: 200 });
    });

    const deps = defaultDeps();
    deps.skillMatcher = new SkillMatcher({ enabled: true, apiKey: 'test' }, logger);
    deps.skillsDir = tmpSkillsDir;
    deps.ruleEngine.register({
      id: 'r1', name: 'Review', description: 'review rule',
      pattern: '.*', action: 'warn', category: 'review',
      enabled: true, tags: ['review'],
    });
    const hook = createRuleEnforcementHook(deps);

    const ctx: HookContext = { event: 'after:tool', toolName: 'habitat_doc_create', data: {} };
    await hook.handler(ctx);

    expect(ctx.data?.hints).toBeDefined();
    const hints = ctx.data!.hints as string;
    expect(hints).toContain('habitat_skill_resolve("code-review")');
    expect(hints).toContain('discovered by context matching');

    fetchSpy.mockRestore();
    await fs.rm(tmpSkillsDir, { recursive: true, force: true });
  });

  it('does not call discoverSkills when matchRule already found skills', async () => {
    const tmpSkillsDir = join(tmpdir(), `re-nodiscover-${Date.now()}`);
    await fs.mkdir(tmpSkillsDir, { recursive: true });
    await fs.writeFile(
      join(tmpSkillsDir, `${SKILL_PROJECT_ITERATE}.md`),
      `---\nname: ${SKILL_PROJECT_ITERATE}\ndescription: "Workflow protocol"\ntags: [workflow]\n---\n# ${SKILL_PROJECT_ITERATE}\n`,
    );

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({
        content: [{ type: 'text', text: `[{"skillName":"${SKILL_PROJECT_ITERATE}","confidence":0.9,"reasoning":"match"}]` }],
      }), { status: 200 }),
    );

    const deps = defaultDeps();
    deps.skillMatcher = new SkillMatcher({ enabled: true, apiKey: 'test' }, logger);
    deps.skillsDir = tmpSkillsDir;
    deps.ruleEngine.register({
      id: 'r1', name: 'Workflow', description: 'workflow rule',
      pattern: '.*', action: 'warn', category: 'workflow',
      enabled: true, tags: ['workflow'],
    });
    const hook = createRuleEnforcementHook(deps);

    const ctx: HookContext = { event: 'after:tool', toolName: 'habitat_doc_create', data: {} };
    await hook.handler(ctx);

    // Only 1 fetch call (matchRule), no discoverSkills call
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const hints = ctx.data!.hints as string;
    expect(hints).toContain(`habitat_skill_resolve("${SKILL_PROJECT_ITERATE}")`);
    expect(hints).not.toContain('discovered by context matching');

    fetchSpy.mockRestore();
    await fs.rm(tmpSkillsDir, { recursive: true, force: true });
  });
});