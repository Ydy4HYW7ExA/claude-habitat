import { describe, it, expect } from 'vitest';
import { documentChecks } from '../../src/domain/document/integrity.js';
import type { Document } from '../../src/domain/document/types.js';

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc-1',
    name: 'Test',
    summary: 'A test doc',
    content: '',
    tags: ['a', 'b'],
    keywords: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    refs: [],
    refsBy: [],
    ...overrides,
  };
}

describe('documentChecks', () => {
  const [checkRequired, checkTags, checkTimestamps] = documentChecks;

  describe('required fields check', () => {
    it('reports no issues for valid doc', () => {
      expect(checkRequired(makeDoc())).toHaveLength(0);
    });

    it('reports error for missing id', () => {
      const issues = checkRequired(makeDoc({ id: '' }));
      expect(issues).toHaveLength(1);
      expect(issues[0].category).toBe('id');
    });

    it('reports error for missing name', () => {
      const issues = checkRequired(makeDoc({ name: '' }));
      expect(issues).toHaveLength(1);
      expect(issues[0].category).toBe('name');
    });

    it('reports error for missing summary', () => {
      const issues = checkRequired(makeDoc({ summary: '' }));
      expect(issues).toHaveLength(1);
      expect(issues[0].category).toBe('summary');
    });

    it('reports multiple errors', () => {
      const issues = checkRequired(makeDoc({ id: '', name: '', summary: '' }));
      expect(issues).toHaveLength(3);
    });
  });

  describe('tags check', () => {
    it('reports no issues for 2-8 tags', () => {
      expect(checkTags(makeDoc({ tags: ['a', 'b'] }))).toHaveLength(0);
    });

    it('reports error for fewer than 2 tags', () => {
      const issues = checkTags(makeDoc({ tags: ['only-one'] }));
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('error');
    });

    it('reports warning for more than 8 tags', () => {
      const tags = Array.from({ length: 9 }, (_, i) => `tag-${i}`);
      const issues = checkTags(makeDoc({ tags }));
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('warning');
    });
  });

  describe('timestamps check', () => {
    it('reports no issues for valid timestamps', () => {
      expect(checkTimestamps(makeDoc())).toHaveLength(0);
    });

    it('reports error for missing createdAt', () => {
      const issues = checkTimestamps(makeDoc({ createdAt: '' }));
      expect(issues).toHaveLength(1);
      expect(issues[0].category).toBe('timestamp');
    });

    it('reports error for missing updatedAt', () => {
      const issues = checkTimestamps(makeDoc({ updatedAt: '' }));
      expect(issues).toHaveLength(1);
    });

    it('reports two errors when both missing', () => {
      const issues = checkTimestamps(makeDoc({ createdAt: '', updatedAt: '' }));
      expect(issues).toHaveLength(2);
    });
  });
});
