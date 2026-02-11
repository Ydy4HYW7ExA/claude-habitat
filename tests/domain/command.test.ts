import { describe, it, expect } from 'vitest';
import { CommandRegistry } from '../../src/domain/command/registry.js';

describe('CommandRegistry', () => {
  it('registers and executes commands', async () => {
    const reg = new CommandRegistry();
    reg.register({
      name: 'hello',
      description: 'Say hello',
      handler: (args) => `Hello ${args[0]}!`,
    });
    const result = await reg.execute('hello', ['World']);
    expect(result).toBe('Hello World!');
  });

  it('lists commands', () => {
    const reg = new CommandRegistry();
    reg.register({ name: 'a', description: 'A', handler: () => 'a' });
    reg.register({ name: 'b', description: 'B', handler: () => 'b' });
    expect(reg.list()).toHaveLength(2);
  });

  it('throws for unknown command', async () => {
    const reg = new CommandRegistry();
    await expect(reg.execute('nope', [])).rejects.toThrow('Unknown command');
  });

  it('unregisters commands', () => {
    const reg = new CommandRegistry();
    reg.register({ name: 'x', description: 'X', handler: () => 'x' });
    reg.unregister('x');
    expect(reg.get('x')).toBeUndefined();
  });
});
