import { describe, it, expect, vi } from 'vitest';
import { createBuiltinHooks } from '../../src/domain/hook/builtins.js';
import { Logger } from '../../src/logging/logger.js';

describe('createBuiltinHooks', () => {
  it('returns an array with the error logger hook', () => {
    const logger = new Logger({ level: 'error' });
    const hooks = createBuiltinHooks(logger);
    expect(hooks).toHaveLength(1);
    expect(hooks[0].id).toBe('builtin:log-errors');
    expect(hooks[0].event).toBe('on:error');
    expect(hooks[0].name).toBe('Error Logger');
    expect(hooks[0].priority).toBe(0);
  });

  it('handler calls logger.error when context has error', () => {
    const logger = new Logger({ level: 'error' });
    const spy = vi.spyOn(logger, 'error');
    const hooks = createBuiltinHooks(logger);
    const handler = hooks[0].handler;

    handler({ event: 'on:error', error: new Error('boom') });

    expect(spy).toHaveBeenCalledWith('Hook error: boom');
  });

  it('handler does nothing when context has no error', () => {
    const logger = new Logger({ level: 'error' });
    const spy = vi.spyOn(logger, 'error');
    const hooks = createBuiltinHooks(logger);
    const handler = hooks[0].handler;

    handler({ event: 'on:error' });

    expect(spy).not.toHaveBeenCalled();
  });
});
