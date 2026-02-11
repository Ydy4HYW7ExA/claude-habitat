import { describe, it, expect } from 'vitest';
import { ok, err, envelope, envelopeError } from '../../src/infra/types.js';

describe('ok()', () => {
  it('returns a success result with value', () => {
    const result = ok(42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('works with object values', () => {
    const result = ok({ name: 'test' });
    expect(result.ok).toBe(true);
    expect((result as any).value).toEqual({ name: 'test' });
  });
});

describe('err()', () => {
  it('returns a failure result with error string', () => {
    const result = err('something failed');
    expect(result).toEqual({ ok: false, error: 'something failed' });
  });
});

describe('envelope()', () => {
  it('wraps data in success envelope', () => {
    const result = envelope({ id: 1 });
    expect(result).toEqual({ success: true, data: { id: 1 } });
  });
});

describe('envelopeError()', () => {
  it('wraps error in failure envelope', () => {
    const result = envelopeError('bad request');
    expect(result).toEqual({ success: false, error: 'bad request' });
  });
});
