export interface Issue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  entityId?: string;
  repairable: boolean;
  repair?: () => Promise<void>;
}

export interface Report {
  valid: boolean;
  issues: Issue[];
  stats: Record<string, number>;
}

export type Check<T> = (entity: T) => Issue[];

export class IntegrityChecker<T> {
  constructor(private checks: Check<T>[]) {}

  check(entity: T): Report {
    const issues: Issue[] = [];
    for (const check of this.checks) {
      issues.push(...check(entity));
    }
    const stats: Record<string, number> = {};
    for (const issue of issues) {
      stats[issue.severity] = (stats[issue.severity] ?? 0) + 1;
    }
    return {
      valid: !issues.some((i) => i.severity === 'error'),
      issues,
      stats,
    };
  }

  async repair(entity: T): Promise<{ fixed: number; remaining: number }> {
    const report = this.check(entity);
    let fixed = 0;
    const remaining: Issue[] = [];

    for (const issue of report.issues) {
      if (issue.repairable && issue.repair) {
        await issue.repair();
        fixed++;
      } else {
        remaining.push(issue);
      }
    }

    return { fixed, remaining: remaining.length };
  }
}
