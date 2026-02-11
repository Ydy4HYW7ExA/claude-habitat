export interface RuleTriggerRecord {
  ruleId: string;
  ruleName: string;
  toolName: string;
  timestamp: number;
  matchedSkills: string[];
}

export interface SkillInvocationRecord {
  skillName: string;
  toolName: string;
  timestamp: number;
}

export interface SessionStats {
  ruleTriggers: Map<string, number>;
  skillInvocations: Map<string, number>;
  unmatchedRules: string[];
  totalToolCalls: number;
  sessionStartTime: number;
}
