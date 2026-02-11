import { promises as fs } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { isEnoent } from './fs-utils.js';

export interface StoreOptions<T> {
  serialize?: (item: T) => string;
  deserialize?: (raw: string) => T;
  extension?: string;
}

export class JsonStore<T> {
  private ext: string;
  private serialize: (item: T) => string;
  private deserialize: (raw: string) => T;

  constructor(
    private baseDir: string,
    options?: StoreOptions<T>,
  ) {
    this.ext = options?.extension ?? '.json';
    this.serialize = options?.serialize ?? ((item) => JSON.stringify(item, null, 2));
    this.deserialize = options?.deserialize ?? ((raw) => JSON.parse(raw) as T);
  }

  private filePath(id: string): string {
    const resolved = resolve(this.baseDir, `${id}${this.ext}`);
    const base = resolve(this.baseDir);
    if (!resolved.startsWith(base + '/') && resolved !== base) {
      throw new Error(`Path traversal detected: ${id}`);
    }
    return resolved;
  }

  async ensureDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  async save(id: string, item: T): Promise<void> {
    const path = this.filePath(id);
    await fs.mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    await fs.writeFile(tmp, this.serialize(item), 'utf-8');
    await fs.rename(tmp, path);
  }

  async load(id: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(this.filePath(id), 'utf-8');
      return this.deserialize(raw);
    } catch (e) {
      if (isEnoent(e)) return null;
      throw e;
    }
  }

  async loadAll(): Promise<T[]> {
    const ids = await this.list();
    const items: T[] = [];
    for (const id of ids) {
      const item = await this.load(id);
      if (item !== null) items.push(item);
    }
    return items;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await fs.unlink(this.filePath(id));
      return true;
    } catch (e) {
      if (isEnoent(e)) return false;
      throw e;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      await fs.access(this.filePath(id));
      return true;
    } catch (e) {
      if (isEnoent(e)) return false;
      throw e;
    }
  }

  async list(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.baseDir);
      return files
        .filter((f) => f.endsWith(this.ext))
        .map((f) => f.slice(0, -this.ext.length));
    } catch (e) {
      if (isEnoent(e)) return [];
      throw e;
    }
  }
}
