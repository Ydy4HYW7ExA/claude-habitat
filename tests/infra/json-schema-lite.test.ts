import { describe, it, expect } from 'vitest';
import { validateJsonSchema } from '../../src/infra/json-schema-lite.js';

describe('validateJsonSchema', () => {
  it('returns error for non-object input', () => {
    const errors = validateJsonSchema('string', {
      type: 'object',
      properties: {},
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Input must be an object');
  });

  it('returns error for null input', () => {
    const errors = validateJsonSchema(null, {
      type: 'object',
      properties: {},
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Input must be an object');
  });

  it('returns error for array input', () => {
    const errors = validateJsonSchema([1, 2], {
      type: 'object',
      properties: {},
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Input must be an object');
  });

  it('detects missing required fields', () => {
    const errors = validateJsonSchema({}, {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Missing required field: name');
    expect(errors[0].path).toBe('name');
  });

  it('detects type mismatch', () => {
    const errors = validateJsonSchema({ count: 'not-a-number' }, {
      type: 'object',
      properties: { count: { type: 'number' } },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Expected number, got string');
  });

  it('passes valid input', () => {
    const errors = validateJsonSchema(
      { name: 'test', count: 42 },
      {
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'number' },
        },
        required: ['name'],
      },
    );
    expect(errors).toHaveLength(0);
  });

  it('distinguishes array from object type', () => {
    const errors = validateJsonSchema({ items: [1, 2] }, {
      type: 'object',
      properties: { items: { type: 'object' } },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Expected object, got array');
  });

  it('skips properties without type constraint', () => {
    const errors = validateJsonSchema({ anything: 123 }, {
      type: 'object',
      properties: { anything: {} },
    });
    expect(errors).toHaveLength(0);
  });
});
