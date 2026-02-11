import type { Plugin, PluginEntry, PluginStatus } from './types.js';
import type { Logger } from '../../logging/logger.js';

export class PluginManager {
  private plugins = new Map<string, PluginEntry>();

  constructor(private logger: Logger) {}

  register(plugin: Plugin): void {
    this.plugins.set(plugin.name, {
      plugin,
      status: 'registered',
    });
  }

  async activate(name: string): Promise<void> {
    const entry = this.plugins.get(name);
    if (!entry) throw new Error(`Plugin not found: ${name}`);
    try {
      await entry.plugin.init?.();
      entry.status = 'active';
      this.logger.info('Plugin activated', { name });
    } catch (err) {
      entry.status = 'error';
      entry.error = String(err);
      this.logger.error('Plugin activation failed', { name, error: String(err) });
      throw err;
    }
  }

  async deactivate(name: string): Promise<void> {
    const entry = this.plugins.get(name);
    if (!entry) throw new Error(`Plugin not found: ${name}`);
    try {
      await entry.plugin.dispose?.();
      entry.status = 'disposed';
    } catch (err) {
      entry.status = 'error';
      entry.error = String(err);
      this.logger.error('Plugin deactivation failed', { name, error: String(err) });
      throw err;
    }
  }

  getStatus(name: string): PluginStatus | undefined {
    return this.plugins.get(name)?.status;
  }

  list(): PluginEntry[] {
    return [...this.plugins.values()];
  }

  async disposeAll(): Promise<void> {
    for (const [name, entry] of this.plugins) {
      if (entry.status === 'active') {
        await this.deactivate(name);
      }
    }
  }
}
