export type Token<T> = symbol & { __type?: T };

export function createToken<T>(name: string): Token<T> {
  return Symbol(name) as Token<T>;
}

type Scope = 'singleton' | 'transient';

interface Registration<T> {
  factory: (container: Container) => T;
  scope: Scope;
  instance?: T;
}

export interface Disposable {
  dispose(): void | Promise<void>;
}

function isDisposable(value: unknown): value is Disposable {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dispose' in value &&
    typeof (value as Disposable).dispose === 'function'
  );
}

export class Container {
  private registrations = new Map<symbol, Registration<unknown>>();
  private parent?: Container;

  register<T>(token: Token<T>, factory: (c: Container) => T, scope: Scope = 'singleton'): this {
    this.registrations.set(token, { factory, scope });
    return this;
  }

  resolve<T>(token: Token<T>): T {
    const reg = this.registrations.get(token) as Registration<T> | undefined;
    if (reg) {
      if (reg.scope === 'singleton') {
        if (reg.instance === undefined) {
          reg.instance = reg.factory(this);
        }
        return reg.instance;
      }
      return reg.factory(this);
    }
    if (this.parent) {
      return this.parent.resolve(token);
    }
    throw new Error(`No registration for token: ${String(token)}`);
  }

  has<T>(token: Token<T>): boolean {
    if (this.registrations.has(token)) return true;
    if (this.parent) return this.parent.has(token);
    return false;
  }

  createChild(): Container {
    const child = new Container();
    child.parent = this;
    return child;
  }

  async dispose(): Promise<void> {
    for (const reg of this.registrations.values()) {
      if (reg.instance !== undefined && isDisposable(reg.instance)) {
        await reg.instance.dispose();
      }
    }
    this.registrations.clear();
  }
}
