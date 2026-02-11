import { describe, it, expect } from 'vitest';
import { query } from '../../src/infra/query.js';

interface Item {
  id: number;
  name: string;
  score: number;
}

const items: Item[] = [
  { id: 1, name: 'alpha', score: 80 },
  { id: 2, name: 'beta', score: 90 },
  { id: 3, name: 'gamma', score: 70 },
  { id: 4, name: 'delta', score: 85 },
  { id: 5, name: 'epsilon', score: 95 },
];

describe('query', () => {
  it('returns all items with no options', () => {
    const r = query(items);
    expect(r.results).toHaveLength(5);
    expect(r.total).toBe(5);
  });

  it('filters items', () => {
    const r = query(items, { filters: [(i) => i.score >= 85] });
    expect(r.results.map((i) => i.name)).toEqual(['beta', 'delta', 'epsilon']);
    expect(r.total).toBe(3);
  });

  it('applies multiple filters (AND)', () => {
    const r = query(items, {
      filters: [(i) => i.score >= 80, (i) => i.name.length <= 5],
    });
    expect(r.results.map((i) => i.name)).toEqual(['alpha', 'beta', 'delta']);
  });

  it('sorts by key ascending', () => {
    const r = query(items, { sortBy: 'score', sortOrder: 'asc' });
    expect(r.results.map((i) => i.score)).toEqual([70, 80, 85, 90, 95]);
  });

  it('sorts by key descending', () => {
    const r = query(items, { sortBy: 'score', sortOrder: 'desc' });
    expect(r.results.map((i) => i.score)).toEqual([95, 90, 85, 80, 70]);
  });

  it('sorts with custom comparator', () => {
    const r = query(items, {
      sortBy: (a, b) => a.name.localeCompare(b.name),
    });
    expect(r.results.map((i) => i.name)).toEqual([
      'alpha', 'beta', 'delta', 'epsilon', 'gamma',
    ]);
  });

  it('paginates with offset and limit', () => {
    const r = query(items, { offset: 1, limit: 2 });
    expect(r.results.map((i) => i.id)).toEqual([2, 3]);
    expect(r.total).toBe(5);
  });

  it('combines filter + sort + paginate', () => {
    const r = query(items, {
      filters: [(i) => i.score >= 80],
      sortBy: 'score',
      sortOrder: 'desc',
      offset: 1,
      limit: 2,
    });
    expect(r.results.map((i) => i.name)).toEqual(['beta', 'delta']);
    expect(r.total).toBe(4);
  });
});
