import { describe, it, expect } from 'vitest';
import { DuplicateError, DependencyError } from '../../src/infra/errors.js';

describe('DuplicateError', () => {
  it('sets message, code, and details', () => {
    const err = new DuplicateError('Document', 'doc-123');
    expect(err.message).toBe('Document already exists: doc-123');
    expect(err.code).toBe('DUPLICATE');
    expect(err.name).toBe('DuplicateError');
    expect(err.details).toEqual({ entity: 'Document', id: 'doc-123' });
    expect(err).toBeInstanceOf(Error);
  });
});

describe('DependencyError', () => {
  it('sets message and code', () => {
    const err = new DependencyError('Missing dep X');
    expect(err.message).toBe('Missing dep X');
    expect(err.code).toBe('DEPENDENCY_ERROR');
    expect(err.name).toBe('DependencyError');
    expect(err.details).toBeUndefined();
    expect(err).toBeInstanceOf(Error);
  });
});
