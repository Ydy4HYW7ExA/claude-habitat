import type { Rule, RuleMatch, RuleScope } from './types.js';
import type { Logger } from '../../logging/logger.js';

export class RuleEngine {
  private rules = new Map<string, Rule>();

  constructor(private logger?: Logger) {}

  register(rule: Partial<Rule> & Pick<Rule, 'id' | 'name' | 'description' | 'pattern' | 'action' | 'category' | 'enabled'>): void {
    const full: Rule = {
      priority: 100,
      tags: [],
      scope: 'all',
      ...rule,
    };
    this.rules.set(full.id, full);
  }

  unregister(id: string): void {
    this.rules.delete(id);
  }

  evaluate(input: string, category?: string, scope?: RuleScope): RuleMatch[] {
    const matches: RuleMatch[] = [];
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (category && rule.category !== category) continue;
      if (scope && rule.scope !== 'all' && rule.scope !== scope) continue;

      let matched = false;
      if (typeof rule.pattern === 'string') {
        matched = input.includes(rule.pattern);
        if (!matched) {
          try {
            matched = new RegExp(rule.pattern, 'i').test(input);
          } catch {
            this.logger?.debug('Invalid regex pattern, using string match', { pattern: rule.pattern });
          }
        }
      } else {
        matched = rule.pattern.test(input);
      }

      if (matched) {
        matches.push({
          ruleId: rule.id,
          ruleName: rule.name,
          action: rule.action,
          message: rule.description,
          priority: rule.priority,
        });
      }
    }
    return matches.sort((a, b) => a.priority - b.priority);
  }

  getAll(): Rule[] {
    return [...this.rules.values()];
  }

  get(id: string): Rule | undefined {
    return this.rules.get(id);
  }
}
