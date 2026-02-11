import { describe, it, expect } from 'vitest';
import { SecurityValidator } from '../../src/domain/security/validator.js';
import { RateLimiter } from '../../src/domain/security/rate-limiter.js';
import { Logger } from '../../src/logging/logger.js';

describe('SecurityValidator', () => {
  const validator = new SecurityValidator(
    new Logger({ level: 'error' }),
    { maxInputLength: 100 },
  );

  it('uses default maxInputLength when no opts', () => {
    const v = new SecurityValidator(new Logger({ level: 'error' }));
    // 100000 is the default, so 100001 chars should trigger
    const result = v.validate('x'.repeat(100001));
    expect(result.safe).toBe(false);
    expect(result.threats[0]).toContain('max length');
  });

  it('passes safe input', () => {
    const result = validator.validate('Hello world');
    expect(result.safe).toBe(true);
  });

  it('detects XSS script tags', () => {
    const result = validator.validate('<script>alert(1)</script>');
    expect(result.safe).toBe(false);
    expect(result.threats).toContain('XSS script tag');
  });

  it('detects path traversal', () => {
    const result = validator.validate('../../etc/passwd');
    expect(result.safe).toBe(false);
  });

  it('detects oversized input', () => {
    const result = validator.validate('x'.repeat(200));
    expect(result.safe).toBe(false);
  });

  it('sanitizes dangerous content', () => {
    const result = validator.sanitize(
      '<script>bad</script> hello',
    );
    expect(result).not.toContain('<script>');
    expect(result).toContain('hello');
  });
});

describe('RateLimiter', () => {
  it('allows requests within limit', () => {
    const limiter = new RateLimiter(3, 1000);
    expect(limiter.tryAcquire('key')).toBe(true);
    expect(limiter.tryAcquire('key')).toBe(true);
    expect(limiter.tryAcquire('key')).toBe(true);
  });

  it('blocks requests over limit', () => {
    const limiter = new RateLimiter(2, 1000);
    limiter.tryAcquire('key');
    limiter.tryAcquire('key');
    expect(limiter.tryAcquire('key')).toBe(false);
  });

  it('records on a fresh key', () => {
    const limiter = new RateLimiter(3, 1000);
    limiter.record('fresh');
    // After one record, should still be under limit
    expect(limiter.check('fresh')).toBe(true);
  });

  it('resets a key', () => {
    const limiter = new RateLimiter(1, 1000);
    limiter.tryAcquire('key');
    limiter.reset('key');
    expect(limiter.tryAcquire('key')).toBe(true);
  });

  it('isolates keys', () => {
    const limiter = new RateLimiter(1, 1000);
    limiter.tryAcquire('a');
    expect(limiter.tryAcquire('b')).toBe(true);
  });
});
