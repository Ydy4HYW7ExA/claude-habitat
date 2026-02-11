import { describe, it, expect } from 'vitest';
import { PluginManager } from '../../src/domain/plugin/manager.js';
import { Logger } from '../../src/logging/logger.js';

describe('PluginManager', () => {
  it('registers and activates plugins', async () => {
    const mgr = new PluginManager(new Logger({ level: 'error' }));
    let initialized = false;
    mgr.register({
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test',
      init: () => { initialized = true; },
    });
    await mgr.activate('test-plugin');
    expect(initialized).toBe(true);
    expect(mgr.getStatus('test-plugin')).toBe('active');
  });

  it('deactivates plugins', async () => {
    const mgr = new PluginManager(new Logger({ level: 'error' }));
    let disposed = false;
    mgr.register({
      name: 'p',
      version: '1.0.0',
      description: 'P',
      init: () => {},
      dispose: () => { disposed = true; },
    });
    await mgr.activate('p');
    await mgr.deactivate('p');
    expect(disposed).toBe(true);
    expect(mgr.getStatus('p')).toBe('disposed');
  });

  it('throws on activation errors and sets error status', async () => {
    const mgr = new PluginManager(new Logger({ level: 'error' }));
    mgr.register({
      name: 'bad',
      version: '1.0.0',
      description: 'Bad',
      init: () => { throw new Error('fail'); },
    });
    await expect(mgr.activate('bad')).rejects.toThrow('fail');
    expect(mgr.getStatus('bad')).toBe('error');
  });

  it('lists plugins', () => {
    const mgr = new PluginManager(new Logger({ level: 'error' }));
    mgr.register({ name: 'a', version: '1.0.0', description: 'A' });
    mgr.register({ name: 'b', version: '1.0.0', description: 'B' });
    expect(mgr.list()).toHaveLength(2);
  });

  it('throws for unknown plugin on deactivate', async () => {
    const mgr = new PluginManager(new Logger({ level: 'error' }));
    await expect(mgr.deactivate('nope')).rejects.toThrow('not found');
  });

  it('throws for unknown plugin', async () => {
    const mgr = new PluginManager(new Logger({ level: 'error' }));
    await expect(mgr.activate('nope')).rejects.toThrow('not found');
  });

  it('sets error status when dispose throws during deactivate', async () => {
    const mgr = new PluginManager(new Logger({ level: 'error' }));
    mgr.register({
      name: 'bad-dispose',
      version: '1.0.0',
      description: 'Dispose fails',
      init: () => {},
      dispose: () => { throw new Error('dispose boom'); },
    });
    await mgr.activate('bad-dispose');
    await expect(mgr.deactivate('bad-dispose')).rejects.toThrow('dispose boom');
    expect(mgr.getStatus('bad-dispose')).toBe('error');
  });

  it('disposeAll deactivates all active plugins', async () => {
    const mgr = new PluginManager(new Logger({ level: 'error' }));
    const disposed: string[] = [];
    mgr.register({
      name: 'a', version: '1.0.0', description: 'A',
      init: () => {},
      dispose: () => { disposed.push('a'); },
    });
    mgr.register({
      name: 'b', version: '1.0.0', description: 'B',
      init: () => {},
      dispose: () => { disposed.push('b'); },
    });
    await mgr.activate('a');
    await mgr.activate('b');
    await mgr.disposeAll();
    expect(disposed.sort()).toEqual(['a', 'b']);
    expect(mgr.getStatus('a')).toBe('disposed');
    expect(mgr.getStatus('b')).toBe('disposed');
  });
});
