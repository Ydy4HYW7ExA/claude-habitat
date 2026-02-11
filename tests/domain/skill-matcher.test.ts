import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkillMatcher } from '../../src/domain/skill-matcher/matcher.js';
import { Logger } from '../../src/logging/logger.js';
import type { SkillSummary } from '../../src/domain/skill-matcher/types.js';
import { SKILL_PROJECT_ITERATE, RULE_WORKFLOW_ID } from '../../src/preset/constants.js';

const logger = new Logger({ level: 'error' });

const testSkills: SkillSummary[] = [
  { name: SKILL_PROJECT_ITERATE, description: 'Workflow iteration protocol', tags: ['workflow'] },
  { name: 'code-review', description: 'Code review protocol', tags: ['review'] },
];

const testRule = {
  id: RULE_WORKFLOW_ID,
  name: 'Workflow Protocol',
  description: 'Enforces workflow for multi-step tasks',
  category: 'workflow',
  tags: ['workflow', 'protocol'],
};

describe('SkillMatcher', () => {
  it('returns empty array when enabled=false', async () => {
    const matcher = new SkillMatcher({ enabled: false }, logger);
    const results = await matcher.matchRule(testRule, testSkills);
    expect(results).toEqual([]);
  });

  it('returns empty array when no API key configured', async () => {
    const matcher = new SkillMatcher({ enabled: true }, logger);
    const results = await matcher.matchRule(testRule, testSkills);
    expect(results).toEqual([]);
  });

  it('returns empty array when no skills available', async () => {
    const matcher = new SkillMatcher({ enabled: true, apiKey: 'test-key' }, logger);
    const results = await matcher.matchRule(testRule, []);
    expect(results).toEqual([]);
  });

  it('caches results and does not call LLM twice', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({
        content: [{ type: 'text', text: `[{"skillName":"${SKILL_PROJECT_ITERATE}","confidence":0.9,"reasoning":"match"}]` }],
      }), { status: 200 }),
    );

    const matcher = new SkillMatcher({ enabled: true, apiKey: 'test-key' }, logger);
    const r1 = await matcher.matchRule(testRule, testSkills);
    const r2 = await matcher.matchRule(testRule, testSkills);

    expect(r1).toHaveLength(1);
    expect(r1[0].skillName).toBe(SKILL_PROJECT_ITERATE);
    expect(r2).toEqual(r1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockRestore();
  });

  it('invalidateCache() clears all cache', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({
        content: [{ type: 'text', text: `[{"skillName":"${SKILL_PROJECT_ITERATE}","confidence":0.9,"reasoning":"match"}]` }],
      }), { status: 200 }),
    );

    const matcher = new SkillMatcher({ enabled: true, apiKey: 'test-key' }, logger);
    await matcher.matchRule(testRule, testSkills);
    matcher.invalidateCache();
    await matcher.matchRule(testRule, testSkills);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mockRestore();
  });

  it('invalidateCache(ruleId) clears only that rule', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({
        content: [{ type: 'text', text: '[]' }],
      }), { status: 200 }),
    );

    const matcher = new SkillMatcher({ enabled: true, apiKey: 'test-key' }, logger);
    await matcher.matchRule(testRule, testSkills);
    const otherRule = { ...testRule, id: 'rule-other', name: 'Other' };
    await matcher.matchRule(otherRule, testSkills);

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    matcher.invalidateCache(RULE_WORKFLOW_ID);
    await matcher.matchRule(testRule, testSkills);
    await matcher.matchRule(otherRule, testSkills); // still cached

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    fetchSpy.mockRestore();
  });

  it('matchAll returns Map of results', async () => {
    const matcher = new SkillMatcher({ enabled: false }, logger);
    const results = await matcher.matchAll([testRule], testSkills);
    expect(results).toBeInstanceOf(Map);
    expect(results.get(RULE_WORKFLOW_ID)).toEqual([]);
  });

  it('returns empty array on invalid JSON response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({
        content: [{ type: 'text', text: 'not valid json at all' }],
      }), { status: 200 }),
    );

    const matcher = new SkillMatcher({ enabled: true, apiKey: 'test-key' }, logger);
    const results = await matcher.matchRule(testRule, testSkills);
    expect(results).toEqual([]);
    fetchSpy.mockRestore();
  });

  it('returns empty array on network error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('network failure'),
    );

    const matcher = new SkillMatcher({ enabled: true, apiKey: 'test-key' }, logger);
    const results = await matcher.matchRule(testRule, testSkills);
    expect(results).toEqual([]);
    fetchSpy.mockRestore();
  });

  it('returns empty array on non-200 status', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response('error', { status: 500 }),
    );

    const matcher = new SkillMatcher({ enabled: true, apiKey: 'test-key' }, logger);
    const results = await matcher.matchRule(testRule, testSkills);
    expect(results).toEqual([]);
    fetchSpy.mockRestore();
  });

  it('filters results below confidence threshold', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({
        content: [{ type: 'text', text: `[{"skillName":"${SKILL_PROJECT_ITERATE}","confidence":0.3,"reasoning":"weak"}]` }],
      }), { status: 200 }),
    );

    const matcher = new SkillMatcher({ enabled: true, apiKey: 'test-key', confidenceThreshold: 0.6 }, logger);
    const results = await matcher.matchRule(testRule, testSkills);
    expect(results).toEqual([]);
    fetchSpy.mockRestore();
  });

  it('prompt does not contain Rule ID or Tags fields', async () => {
    let capturedBody = '';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, opts) => {
      capturedBody = (opts as RequestInit).body as string;
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: '[]' }],
      }), { status: 200 });
    });

    const matcher = new SkillMatcher({ enabled: true, apiKey: 'test-key' }, logger);
    await matcher.matchRule(testRule, testSkills);

    const parsed = JSON.parse(capturedBody);
    const userMsg = parsed.messages[0].content as string;
    expect(userMsg).not.toContain('Rule ID:');
    expect(userMsg).not.toContain('Category:');
    expect(userMsg).not.toContain('Tags:');
    expect(userMsg).not.toContain('[tags:');
    expect(userMsg).toContain('Rule: Workflow Protocol');
    expect(userMsg).toContain(`- ${SKILL_PROJECT_ITERATE}: Workflow iteration protocol`);

    fetchSpy.mockRestore();
  });

  describe('discoverSkills', () => {
    it('returns empty when enabled=false', async () => {
      const matcher = new SkillMatcher({ enabled: false }, logger);
      const results = await matcher.discoverSkills(
        { toolName: 'habitat_doc_create', summary: 'Creating docs' },
        testSkills,
      );
      expect(results).toEqual([]);
    });

    it('returns matched skills from LLM', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
        new Response(JSON.stringify({
          content: [{ type: 'text', text: '[{"skillName":"code-review","confidence":0.85,"reasoning":"relevant"}]' }],
        }), { status: 200 }),
      );

      const matcher = new SkillMatcher({ enabled: true, apiKey: 'test-key' }, logger);
      const results = await matcher.discoverSkills(
        { toolName: 'habitat_doc_create', summary: 'Creating documentation' },
        testSkills,
      );

      expect(results).toHaveLength(1);
      expect(results[0].skillName).toBe('code-review');
      expect(results[0].confidence).toBe(0.85);

      fetchSpy.mockRestore();
    });

    it('cache is independent from matchRule cache', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
        new Response(JSON.stringify({
          content: [{ type: 'text', text: '[]' }],
        }), { status: 200 }),
      );

      const matcher = new SkillMatcher({ enabled: true, apiKey: 'test-key' }, logger);

      await matcher.matchRule(testRule, testSkills);
      await matcher.discoverSkills(
        { toolName: 'habitat_doc_create', summary: 'test' },
        testSkills,
      );

      // Both should have called fetch independently
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Calling again should use cache (no additional fetch calls)
      await matcher.matchRule(testRule, testSkills);
      await matcher.discoverSkills(
        { toolName: 'habitat_doc_create', summary: 'test' },
        testSkills,
      );
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      fetchSpy.mockRestore();
    });

    it('returns empty on error', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('network failure'),
      );

      const matcher = new SkillMatcher({ enabled: true, apiKey: 'test-key' }, logger);
      const results = await matcher.discoverSkills(
        { toolName: 'habitat_doc_create', summary: 'test' },
        testSkills,
      );
      expect(results).toEqual([]);

      fetchSpy.mockRestore();
    });
  });
});