import { describe, it, expect } from 'vitest';
import { SessionTracker } from '../../src/domain/session/tracker.js';
import { Logger } from '../../src/logging/logger.js';
import { SKILL_PROJECT_ITERATE } from '../../src/preset/constants.js';

const logger = new Logger({ level: 'error' });

describe('SessionTracker', () => {
  it('recordRuleTrigger stores the record', () => {
    const tracker = new SessionTracker(logger);
    tracker.recordRuleTrigger({
      ruleId: 'r1', ruleName: 'Rule One',
      toolName: 'habitat_doc_create', timestamp: 1000,
      matchedSkills: [SKILL_PROJECT_ITERATE],
    });
    const stats = tracker.getStats();
    expect(stats.ruleTriggers.get('r1')).toBe(1);
  });

  it('recordSkillInvocation stores the record', () => {
    const tracker = new SessionTracker(logger);
    tracker.recordSkillInvocation({
      skillName: SKILL_PROJECT_ITERATE,
      toolName: 'habitat_skill_resolve', timestamp: 1000,
    });
    const stats = tracker.getStats();
    expect(stats.skillInvocations.get(SKILL_PROJECT_ITERATE)).toBe(1);
  });

  it('recordToolCall increments counter', () => {
    const tracker = new SessionTracker(logger);
    tracker.recordToolCall();
    tracker.recordToolCall();
    tracker.recordToolCall();
    expect(tracker.getStats().totalToolCalls).toBe(3);
  });

  it('getStats returns correct aggregated data', () => {
    const tracker = new SessionTracker(logger);
    tracker.recordRuleTrigger({
      ruleId: 'r1', ruleName: 'Rule One',
      toolName: 'habitat_doc_create', timestamp: 1000,
      matchedSkills: [SKILL_PROJECT_ITERATE],
    });
    tracker.recordRuleTrigger({
      ruleId: 'r1', ruleName: 'Rule One',
      toolName: 'habitat_doc_update', timestamp: 2000,
      matchedSkills: [],
    });
    tracker.recordRuleTrigger({
      ruleId: 'r2', ruleName: 'Rule Two',
      toolName: 'habitat_workflow_create', timestamp: 3000,
      matchedSkills: [],
    });

    const stats = tracker.getStats();
    expect(stats.ruleTriggers.get('r1')).toBe(2);
    expect(stats.ruleTriggers.get('r2')).toBe(1);
    expect(stats.unmatchedRules).toContain('r1');
    expect(stats.unmatchedRules).toContain('r2');
  });

  it('formatForInjection includes rule names and counts', () => {
    const tracker = new SessionTracker(logger);
    tracker.recordRuleTrigger({
      ruleId: 'r1', ruleName: 'Rule One',
      toolName: 'habitat_doc_create', timestamp: 1000,
      matchedSkills: [SKILL_PROJECT_ITERATE],
    });
    tracker.recordRuleTrigger({
      ruleId: 'r1', ruleName: 'Rule One',
      toolName: 'habitat_doc_update', timestamp: 2000,
      matchedSkills: [SKILL_PROJECT_ITERATE],
    });

    const output = tracker.formatForInjection();
    expect(output).toContain('Rule One');
    expect(output).toContain('2 times');
    expect(output).toContain(SKILL_PROJECT_ITERATE);
  });

  it('formatForInjection returns empty string when no activity', () => {
    const tracker = new SessionTracker(logger);
    expect(tracker.formatForInjection()).toBe('');
  });

  it('reset clears all records', () => {
    const tracker = new SessionTracker(logger);
    tracker.recordToolCall();
    tracker.recordRuleTrigger({
      ruleId: 'r1', ruleName: 'Rule One',
      toolName: 'habitat_doc_create', timestamp: 1000,
      matchedSkills: [],
    });
    tracker.recordSkillInvocation({
      skillName: SKILL_PROJECT_ITERATE,
      toolName: 'habitat_skill_resolve', timestamp: 1000,
    });

    tracker.reset();
    const stats = tracker.getStats();
    expect(stats.totalToolCalls).toBe(0);
    expect(stats.ruleTriggers.size).toBe(0);
    expect(stats.skillInvocations.size).toBe(0);
  });
});