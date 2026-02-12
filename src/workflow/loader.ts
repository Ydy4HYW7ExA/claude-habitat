import type { WorkflowFunction, WorkflowLoaderInterface } from './types.js';
import { pathToFileURL } from 'node:url';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export class WorkflowLoader implements WorkflowLoaderInterface {
  private cache = new Map<string, { module: { default: WorkflowFunction }; mtime: number }>();

  constructor(private projectRoot: string) {}

  async load(workflowPath: string): Promise<WorkflowFunction> {
    const fullPath = path.resolve(this.projectRoot, workflowPath);
    const stat = await fs.stat(fullPath);
    const cached = this.cache.get(fullPath);

    if (cached && cached.mtime >= stat.mtimeMs) {
      return cached.module.default;
    }

    // ESM cache busting via query string
    const url = pathToFileURL(fullPath).href + `?t=${Date.now()}`;
    const module = await import(url);
    this.cache.set(fullPath, { module, mtime: stat.mtimeMs });
    return module.default;
  }

  invalidate(workflowPath: string): void {
    const fullPath = path.resolve(this.projectRoot, workflowPath);
    this.cache.delete(fullPath);
  }

  async getSource(workflowPath: string): Promise<string> {
    const fullPath = path.resolve(this.projectRoot, workflowPath);
    return fs.readFile(fullPath, 'utf-8');
  }
}
