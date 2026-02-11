import { describe, it, expect } from 'vitest';
import { MultiMap } from '../../src/infra/multi-map.js';

describe('MultiMap', () => {
  it('adds and retrieves values', () => {
    const mm = new MultiMap<string, number>();
    mm.add('a', 1);
    mm.add('a', 2);
    expect([...mm.get('a')]).toEqual([1, 2]);
  });

  it('returns empty set for missing key', () => {
    const mm = new MultiMap<string, number>();
    expect(mm.get('x').size).toBe(0);
  });

  it('removes a value from a key', () => {
    const mm = new MultiMap<string, number>();
    mm.add('a', 1);
    mm.add('a', 2);
    mm.remove('a', 1);
    expect([...mm.get('a')]).toEqual([2]);
  });

  it('cleans up empty sets on remove', () => {
    const mm = new MultiMap<string, number>();
    mm.add('a', 1);
    mm.remove('a', 1);
    expect(mm.has('a')).toBe(false);
  });

  it('intersects multiple keys', () => {
    const mm = new MultiMap<string, string>();
    mm.add('tag1', 'doc-a');
    mm.add('tag1', 'doc-b');
    mm.add('tag2', 'doc-b');
    mm.add('tag2', 'doc-c');
    expect([...mm.intersect(['tag1', 'tag2'])]).toEqual(['doc-b']);
  });

  it('intersect returns empty for missing key', () => {
    const mm = new MultiMap<string, string>();
    mm.add('a', 'x');
    expect(mm.intersect(['a', 'missing']).size).toBe(0);
  });

  it('intersect returns empty for empty keys', () => {
    const mm = new MultiMap<string, string>();
    expect(mm.intersect([]).size).toBe(0);
  });

  it('removes value from all keys', () => {
    const mm = new MultiMap<string, string>();
    mm.add('a', 'x');
    mm.add('b', 'x');
    mm.add('b', 'y');
    mm.removeValue('x');
    expect(mm.has('a')).toBe(false);
    expect([...mm.get('b')]).toEqual(['y']);
  });

  it('lists keys', () => {
    const mm = new MultiMap<string, number>();
    mm.add('a', 1);
    mm.add('b', 2);
    expect(mm.keys().sort()).toEqual(['a', 'b']);
  });

  it('counts values for a key', () => {
    const mm = new MultiMap<string, number>();
    mm.add('a', 1);
    mm.add('a', 2);
    expect(mm.count('a')).toBe(2);
    expect(mm.count('missing')).toBe(0);
  });

  it('clears all data', () => {
    const mm = new MultiMap<string, number>();
    mm.add('a', 1);
    mm.clear();
    expect(mm.keys()).toEqual([]);
  });
});
