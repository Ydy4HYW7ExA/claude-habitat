import type { Logger } from '../../logging/logger.js';
import type { RuleTriggerRecord, SkillInvocationRecord, SessionStats } from './types.js';

export class SessionTracker {
  private ruleTriggers: RuleTriggerRecord[] = [];
  private skillInvocations: SkillInvocationRecord[] = [];
  private totalToolCalls = 0;
  private sessionStartTime = Date.now();

  constructor(private logger: Logger) {}

  recordRuleTrigger(record: RuleTriggerRecord): void {
    this.ruleTriggers.push(record);
    this.logger.debug('Rule triggered', { ruleId: record.ruleId, tool: record.toolName });
  }

  recordSkillInvocation(record: SkillInvocationRecord): void {
    this.skillInvocations.push(record);
    this.logger.debug('Skill invoked', { skill: record.skillName, tool: record.toolName });
  }

  recordToolCall(): void {
    this.totalToolCalls++;
  }

  getStats(): SessionStats {
    const ruleTriggers = new Map<string, number>();
    const unmatchedSet = new Set<string>();

    for (const t of this.ruleTriggers) {
      ruleTriggers.set(t.ruleId, (ruleTriggers.get(t.ruleId) ?? 0) + 1);
      if (t.matchedSkills.length === 0) {
        unmatchedSet.add(t.ruleId);
      }
    }

    const skillInvocations = new Map<string, number>();
    for (const s of this.skillInvocations) {
      skillInvocations.set(s.skillName, (skillInvocations.get(s.skillName) ?? 0) + 1);
    }

    return {
      ruleTriggers,
      skillInvocations,
      unmatchedRules: [...unmatchedSet],
      totalToolCalls: this.totalToolCalls,
      sessionStartTime: this.sessionStartTime,
    };
  }

  formatForInjection(): string {
    const stats = this.getStats();
    if (stats.ruleTriggers.size === 0 && stats.skillInvocations.size === 0) {
      return '';
    }

    const lines: string[] = [];

    if (stats.ruleTriggers.size > 0) {
      lines.push('## Session Rule Activity', '');
      for (const [ruleId, count] of stats.ruleTriggers) {
        const trigger = this.ruleTriggers.find((t) => t.ruleId === ruleId);
        const name = trigger?.ruleName ?? ruleId;
        const skills = this.getMatchedSkillsForRule(ruleId);
        const skillText = skills.length > 0 ? skills.join(', ') : 'none';
        lines.push(`- Rule \`${name}\` triggered ${count} times`);
        lines.push(`  - Matched skills: ${skillText}`);
      }
      lines.push('');
    }

    if (stats.skillInvocations.size > 0) {
      lines.push('## Skill Invocations', '');
      for (const [skill, count] of stats.skillInvocations) {
        lines.push(`- \`${skill}\` invoked ${count} times`);
      }
      lines.push('');
    }

    if (stats.unmatchedRules.length > 0) {
      lines.push('## Recommendations', '');
      for (const ruleId of stats.unmatchedRules) {
        const trigger = this.ruleTriggers.find((t) => t.ruleId === ruleId);
        const name = trigger?.ruleName ?? ruleId;
        lines.push(`- Rule \`${name}\` has no matched skill — consider creating one`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  reset(): void {
    this.ruleTriggers = [];
    this.skillInvocations = [];
    this.totalToolCalls = 0;
    this.sessionStartTime = Date.now();
  }

  private getMatchedSkillsForRule(ruleId: string): string[] {
    const skills = new Set<string>();
    for (const t of this.ruleTriggers) {
      if (t.ruleId === ruleId) {
        for (const s of t.matchedSkills) skills.add(s);
      }
    }
    return [...skills];
  }
}
