import { describe, it, expect } from 'vitest';
import { validate, assertValid, ValidatorError } from '../../src/infra/validator.js';

describe('Validator', () => {
  describe('string rules', () => {
    it('requires string fields', () => {
      const errors = validate({}, { name: { type: 'string' } });
      expect(errors).toEqual(['name is required']);
    });

    it('allows optional string', () => {
      const errors = validate({}, { name: { type: 'string', required: false } });
      expect(errors).toEqual([]);
    });

    it('validates min length', () => {
      const errors = validate({ name: 'ab' }, { name: { type: 'string', min: 3 } });
      expect(errors[0]).toContain('at least 3');
    });

    it('validates max length', () => {
      const errors = validate({ name: 'abcdef' }, { name: { type: 'string', max: 3 } });
      expect(errors[0]).toContain('at most 3');
    });

    it('validates pattern', () => {
      const errors = validate(
        { tag: 'UPPER' },
        { tag: { type: 'string', pattern: /^[a-z-]+$/ } },
      );
      expect(errors[0]).toContain('invalid format');
    });

    it('rejects non-string', () => {
      const errors = validate({ name: 42 }, { name: { type: 'string' } });
      expect(errors[0]).toContain('must be a string');
    });
  });

  describe('number rules', () => {
    it('validates min', () => {
      const errors = validate({ n: -1 }, { n: { type: 'number', min: 0 } });
      expect(errors[0]).toContain('>= 0');
    });

    it('validates max', () => {
      const errors = validate({ n: 100 }, { n: { type: 'number', max: 50 } });
      expect(errors[0]).toContain('<= 50');
    });

    it('rejects non-number', () => {
      const errors = validate({ n: 'x' }, { n: { type: 'number' } });
      expect(errors[0]).toContain('must be a number');
    });
  });

  describe('array rules', () => {
    it('validates minItems', () => {
      const errors = validate({ tags: [] }, { tags: { type: 'array', minItems: 1 } });
      expect(errors[0]).toContain('at least 1');
    });

    it('validates maxItems', () => {
      const errors = validate(
        { tags: ['a', 'b', 'c'] },
        { tags: { type: 'array', maxItems: 2 } },
      );
      expect(errors[0]).toContain('at most 2');
    });

    it('rejects non-array', () => {
      const errors = validate({ tags: 'x' }, { tags: { type: 'array' } });
      expect(errors[0]).toContain('must be an array');
    });
  });

  describe('enum rules', () => {
    it('validates enum values', () => {
      const errors = validate(
        { status: 'bad' },
        { status: { type: 'enum', values: ['a', 'b'] } },
      );
      expect(errors[0]).toContain('must be one of');
    });
  });

  describe('boolean rules', () => {
    it('rejects non-boolean', () => {
      const errors = validate({ flag: 'yes' }, { flag: { type: 'boolean' } });
      expect(errors[0]).toContain('must be a boolean');
    });
  });

  describe('custom rules', () => {
    it('runs custom check', () => {
      const errors = validate(
        { email: 'bad' },
        { email: { type: 'custom', check: (v) => (typeof v === 'string' && v.includes('@') ? null : 'must be email') } },
      );
      expect(errors[0]).toContain('must be email');
    });
  });

  describe('assertValid', () => {
    it('throws ValidatorError on failure', () => {
      expect(() => assertValid({}, { name: { type: 'string' } })).toThrow(ValidatorError);
    });

    it('does not throw on valid data', () => {
      expect(() => assertValid({ name: 'ok' }, { name: { type: 'string' } })).not.toThrow();
    });
  });
});
