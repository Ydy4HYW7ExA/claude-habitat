import { describe, it, expect } from 'vitest';
import { HookExecutor } from '../../src/domain/hook/executor.js';
import { Logger } from '../../src/logging/logger.js';

describe('HookExecutor', () => {
  it('registers and emits hooks', async () => {
    const exec = new HookExecutor(new Logger({ level: 'error' }));
    const calls: string[] = [];
    exec.register({
      id: 'h1', event: 'after:create', name: 'Test',
      priority: 0, handler: () => { calls.push('h1'); },
    });
    await exec.emit({ event: 'after:create' });
    expect(calls).toEqual(['h1']);
  });

  it('respects priority order', async () => {
    const exec = new HookExecutor(new Logger({ level: 'error' }));
    const calls: string[] = [];
    exec.register({
      id: 'h2', event: 'after:create', name: 'Low',
      priority: 10, handler: () => { calls.push('low'); },
    });
    exec.register({
      id: 'h1', event: 'after:create', name: 'High',
      priority: 1, handler: () => { calls.push('high'); },
    });
    await exec.emit({ event: 'after:create' });
    expect(calls).toEqual(['high', 'low']);
  });

  it('unregisters hooks', async () => {
    const exec = new HookExecutor(new Logger({ level: 'error' }));
    const calls: string[] = [];
    exec.register({
      id: 'h1', event: 'after:create', name: 'Test',
      priority: 0, handler: () => { calls.push('h1'); },
    });
    exec.unregister('h1');
    await exec.emit({ event: 'after:create' });
    expect(calls).toEqual([]);
  });

  it('handles errors gracefully', async () => {
    const exec = new HookExecutor(new Logger({ level: 'error' }));
    exec.register({
      id: 'h1', event: 'on:error', name: 'Bad',
      priority: 0, handler: () => { throw new Error('boom'); },
    });
    // Should not throw, but return errors
    const result = await exec.emit({ event: 'on:error' });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('boom');
  });

  it('unregister keeps other handlers on same event', async () => {
    const exec = new HookExecutor(new Logger({ level: 'error' }));
    exec.register({
      id: 'h1', event: 'after:create', name: 'A',
      priority: 0, handler: () => {},
    });
    exec.register({
      id: 'h2', event: 'after:create', name: 'B',
      priority: 1, handler: () => {},
    });
    exec.unregister('h1');
    const handlers = exec.getHandlers('after:create');
    expect(handlers).toHaveLength(1);
    expect(handlers[0].id).toBe('h2');
  });

  it('unregister removes event key when list becomes empty', async () => {
    const exec = new HookExecutor(new Logger({ level: 'error' }));
    exec.register({
      id: 'h1', event: 'after:create', name: 'Only',
      priority: 0, handler: () => {},
    });
    exec.unregister('h1');
    // After removing the only handler, getHandlers for that event should be empty
    expect(exec.getHandlers('after:create')).toEqual([]);
  });

  it('getHandlers() without args returns all handlers', () => {
    const exec = new HookExecutor(new Logger({ level: 'error' }));
    exec.register({
      id: 'h1', event: 'after:create', name: 'A',
      priority: 0, handler: () => {},
    });
    exec.register({
      id: 'h2', event: 'on:error', name: 'B',
      priority: 0, handler: () => {},
    });
    const all = exec.getHandlers();
    expect(all).toHaveLength(2);
    expect(all.map((h) => h.id).sort()).toEqual(['h1', 'h2']);
  });

  it('handles non-Error throws gracefully', async () => {
    const exec = new HookExecutor(new Logger({ level: 'error' }));
    exec.register({
      id: 'h1', event: 'on:error', name: 'StringThrower',
      priority: 0, handler: () => { throw 'string error'; },
    });
    const result = await exec.emit({ event: 'on:error' });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('string error');
  });

  it('returns empty errors on success', async () => {
    const exec = new HookExecutor(new Logger({ level: 'error' }));
    exec.register({
      id: 'h1', event: 'after:create', name: 'Good',
      priority: 0, handler: () => {},
    });
    const result = await exec.emit({ event: 'after:create' });
    expect(result.errors).toHaveLength(0);
  });
});
