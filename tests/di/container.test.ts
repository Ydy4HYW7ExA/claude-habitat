import { describe, it, expect } from 'vitest';
import { Container, createToken } from '../../src/di/container.js';

describe('Container', () => {
  it('resolves a singleton registration', () => {
    const token = createToken<string>('test');
    const c = new Container();
    c.register(token, () => 'hello', 'singleton');
    expect(c.resolve(token)).toBe('hello');
    expect(c.resolve(token)).toBe('hello'); // same instance
  });

  it('returns same instance for singleton', () => {
    const token = createToken<{ id: number }>('obj');
    const c = new Container();
    let count = 0;
    c.register(token, () => ({ id: ++count }), 'singleton');
    const a = c.resolve(token);
    const b = c.resolve(token);
    expect(a).toBe(b);
    expect(a.id).toBe(1);
  });

  it('returns new instance for transient', () => {
    const token = createToken<{ id: number }>('obj');
    const c = new Container();
    let count = 0;
    c.register(token, () => ({ id: ++count }), 'transient');
    const a = c.resolve(token);
    const b = c.resolve(token);
    expect(a).not.toBe(b);
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
  });

  it('throws for unregistered token', () => {
    const token = createToken<string>('missing');
    const c = new Container();
    expect(() => c.resolve(token)).toThrow('No registration for token');
  });

  it('checks has()', () => {
    const token = createToken<string>('t');
    const c = new Container();
    expect(c.has(token)).toBe(false);
    c.register(token, () => 'x');
    expect(c.has(token)).toBe(true);
  });

  it('child resolves from parent', () => {
    const token = createToken<string>('t');
    const parent = new Container();
    parent.register(token, () => 'from-parent');
    const child = parent.createChild();
    expect(child.resolve(token)).toBe('from-parent');
  });

  it('child overrides parent', () => {
    const token = createToken<string>('t');
    const parent = new Container();
    parent.register(token, () => 'parent');
    const child = parent.createChild();
    child.register(token, () => 'child');
    expect(child.resolve(token)).toBe('child');
    expect(parent.resolve(token)).toBe('parent');
  });

  it('child has() checks parent', () => {
    const token = createToken<string>('t');
    const parent = new Container();
    parent.register(token, () => 'x');
    const child = parent.createChild();
    expect(child.has(token)).toBe(true);
  });

  it('dispose calls dispose on singleton instances', async () => {
    const token = createToken<{ dispose: () => void; disposed: boolean }>('d');
    const c = new Container();
    c.register(token, () => ({
      disposed: false,
      dispose() { this.disposed = true; },
    }));
    const inst = c.resolve(token);
    expect(inst.disposed).toBe(false);
    await c.dispose();
    expect(inst.disposed).toBe(true);
  });

  it('dispose handles async dispose', async () => {
    const token = createToken<{ dispose: () => Promise<void>; disposed: boolean }>('d');
    const c = new Container();
    c.register(token, () => ({
      disposed: false,
      async dispose() { this.disposed = true; },
    }));
    const inst = c.resolve(token);
    await c.dispose();
    expect(inst.disposed).toBe(true);
  });

  it('factory receives container for dependency resolution', () => {
    const nameToken = createToken<string>('name');
    const greetToken = createToken<string>('greet');
    const c = new Container();
    c.register(nameToken, () => 'World');
    c.register(greetToken, (cont) => `Hello, ${cont.resolve(nameToken)}!`);
    expect(c.resolve(greetToken)).toBe('Hello, World!');
  });

  it('defaults to singleton scope', () => {
    const token = createToken<{ id: number }>('obj');
    const c = new Container();
    let count = 0;
    c.register(token, () => ({ id: ++count }));
    expect(c.resolve(token)).toBe(c.resolve(token));
  });

  it('supports chained registration', () => {
    const a = createToken<string>('a');
    const b = createToken<string>('b');
    const c = new Container();
    c.register(a, () => 'a').register(b, () => 'b');
    expect(c.resolve(a)).toBe('a');
    expect(c.resolve(b)).toBe('b');
  });
});
