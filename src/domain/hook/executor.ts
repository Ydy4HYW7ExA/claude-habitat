import type { HookEvent, HookHandler, HookContext } from './types.js';
import type { Logger } from '../../logging/logger.js';

export class HookExecutor {
  private handlers = new Map<HookEvent, HookHandler[]>();

  constructor(private logger: Logger) {}

  register(handler: HookHandler): void {
    const list = this.handlers.get(handler.event) ?? [];
    list.push(handler);
    list.sort((a, b) => a.priority - b.priority);
    this.handlers.set(handler.event, list);
  }

  unregister(id: string): void {
    for (const [event, list] of this.handlers) {
      const filtered = list.filter((h) => h.id !== id);
      if (filtered.length === 0) {
        this.handlers.delete(event);
      } else {
        this.handlers.set(event, filtered);
      }
    }
  }

  async emit(context: HookContext): Promise<{ errors: Error[] }> {
    const errors: Error[] = [];
    const list = this.handlers.get(context.event) ?? [];
    for (const handler of list) {
      try {
        await handler.handler(context);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push(error);
        this.logger.error(`Hook ${handler.name} failed`, {
          hookId: handler.id,
          event: context.event,
          error: error.message,
        });
      }
    }
    return { errors };
  }

  getHandlers(event?: HookEvent): HookHandler[] {
    if (event) return this.handlers.get(event) ?? [];
    const all: HookHandler[] = [];
    for (const list of this.handlers.values()) {
      all.push(...list);
    }
    return all;
  }
}
