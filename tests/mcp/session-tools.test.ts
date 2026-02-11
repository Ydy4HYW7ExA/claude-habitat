import { describe, it, expect } from 'vitest';
import { SessionTracker } from '../../src/domain/session/tracker.js';
import { Logger } from '../../src/logging/logger.js';
import { SKILL_PROJECT_ITERATE } from '../../src/preset/constants.js';

const logger = new Logger({ level: 'error' });

describe('habitat_session_stats tool', () => {
  it('getStats returns JSON-serializable data', () => {
    const tracker = new SessionTracker(logger);
    tracker.recordToolCall();
    tracker.recordRuleTrigger({
      ruleId: 'r1', ruleName: 'Rule One',
      toolName: 'habitat_doc_create', timestamp: 1000,
      matchedSkills: [],
    });

    const stats = tracker.getStats();
    const json = {
      ruleTriggers: Object.fromEntries(stats.ruleTriggers),
      skillInvocations: Object.fromEntries(stats.skillInvocations),
      unmatchedRules: stats.unmatchedRules,
      totalToolCalls: stats.totalToolCalls,
      sessionStartTime: stats.sessionStartTime,
    };

    expect(json.totalToolCalls).toBe(1);
    expect(json.ruleTriggers['r1']).toBe(1);
    expect(json.unmatchedRules).toContain('r1');
  });

  it('formatForInjection returns markdown when activity exists', () => {
    const tracker = new SessionTracker(logger);
    tracker.recordRuleTrigger({
      ruleId: 'r1', ruleName: 'Workflow Rule',
      toolName: 'habitat_doc_create', timestamp: 1000,
      matchedSkills: [SKILL_PROJECT_ITERATE],
    });
    tracker.recordSkillInvocation({
      skillName: SKILL_PROJECT_ITERATE,
      toolName: 'habitat_skill_resolve', timestamp: 2000,
    });

    const md = tracker.formatForInjection();
    expect(md).toContain('## Session Rule Activity');
    expect(md).toContain('Workflow Rule');
    expect(md).toContain('## Skill Invocations');
    expect(md).toContain(SKILL_PROJECT_ITERATE);
  });

  it('formatForInjection returns empty for no activity', () => {
    const tracker = new SessionTracker(logger);
    const result = tracker.formatForInjection();
    expect(result).toBe('');
  });
});
