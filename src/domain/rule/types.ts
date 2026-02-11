export type RuleScope = 'all' | 'code' | 'document' | 'workflow' | 'config';

export interface Rule {
  id: string;
  name: string;
  description: string;
  pattern: string | RegExp;
  action: 'warn' | 'error' | 'suggest';
  category: string;
  enabled: boolean;
  priority: number;
  tags: string[];
  scope: RuleScope;
  content?: string;
  keywords?: string[];
}

export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  action: Rule['action'];
  message: string;
  priority: number;
  context?: string;
}
