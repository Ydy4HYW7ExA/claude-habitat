import { describe, it, expect } from 'vitest';
import { IntegrityChecker } from '../../src/infra/integrity.js';
import type { Check, Issue } from '../../src/infra/integrity.js';

interface TestEntity {
  id: string;
  name: string;
  tags: string[];
}

describe('IntegrityChecker', () => {
  const nameCheck: Check<TestEntity> = (e) => {
    if (!e.name) return [{ severity: 'error', category: 'name', message: 'Name is empty', entityId: e.id, repairable: false }];
    return [];
  };

  const tagCheck: Check<TestEntity> = (e) => {
    if (e.tags.length === 0) return [{ severity: 'warning', category: 'tags', message: 'No tags', entityId: e.id, repairable: false }];
    return [];
  };

  it('reports no issues for valid entity', () => {
    const checker = new IntegrityChecker([nameCheck, tagCheck]);
    const report = checker.check({ id: '1', name: 'test', tags: ['a'] });
    expect(report.valid).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it('reports errors', () => {
    const checker = new IntegrityChecker([nameCheck]);
    const report = checker.check({ id: '1', name: '', tags: [] });
    expect(report.valid).toBe(false);
    expect(report.issues).toHaveLength(1);
    expect(report.stats['error']).toBe(1);
  });

  it('reports warnings without invalidating', () => {
    const checker = new IntegrityChecker([tagCheck]);
    const report = checker.check({ id: '1', name: 'ok', tags: [] });
    expect(report.valid).toBe(true);
    expect(report.issues).toHaveLength(1);
    expect(report.stats['warning']).toBe(1);
  });

  it('repairs repairable issues', async () => {
    let repaired = false;
    const repairableCheck: Check<TestEntity> = () => [{
      severity: 'error',
      category: 'test',
      message: 'fixable',
      repairable: true,
      repair: async () => { repaired = true; },
    }];
    const checker = new IntegrityChecker([repairableCheck]);
    const result = await checker.repair({ id: '1', name: 'x', tags: [] });
    expect(result.fixed).toBe(1);
    expect(repaired).toBe(true);
  });

  it('counts remaining non-repairable issues', async () => {
    const mixed: Check<TestEntity> = () => [
      { severity: 'error', category: 'a', message: 'fixable', repairable: true, repair: async () => {} },
      { severity: 'error', category: 'b', message: 'not fixable', repairable: false },
    ];
    const checker = new IntegrityChecker([mixed]);
    const result = await checker.repair({ id: '1', name: 'x', tags: [] });
    expect(result.fixed).toBe(1);
    expect(result.remaining).toBe(1);
  });
});
