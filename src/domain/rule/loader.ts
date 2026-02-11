import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { readdirOrEmpty } from '../../infra/fs-utils.js';
import type { Rule } from './types.js';
import type { RuleEngine } from './engine.js';

export class RuleLoader {
  constructor(private engine: RuleEngine) {}

  async loadFromDir(dir: string): Promise<number> {
    let count = 0;
    const files = await readdirOrEmpty(dir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        count += await this.loadJsonFile(join(dir, file));
      } else if (file.endsWith('.md')) {
        count += await this.loadMdFile(join(dir, file));
      }
    }
    return count;
  }

  async loadFromDirs(dirs: string[]): Promise<number> {
    let total = 0;
    for (const dir of dirs) {
      total += await this.loadFromDir(dir);
    }
    return total;
  }

  loadBuiltins(): void {
    this.engine.register({
      id: 'builtin-no-hardcoded-secrets',
      name: 'No Hardcoded Secrets',
      description: 'Avoid hardcoded secrets, tokens, or passwords in source code',
      pattern: /(password|secret|token|api_key)\s*[:=]\s*["'][^"']+["']/i,
      action: 'error',
      category: 'security',
      enabled: true,
      priority: 10,
      tags: ['security', 'secrets'],
      scope: 'code',
    });

    this.engine.register({
      id: 'builtin-todo-markers',
      name: 'TODO Markers',
      description: 'Flag TODO/FIXME/HACK comments for tracking',
      pattern: /\b(TODO|FIXME|HACK|XXX)\b/,
      action: 'warn',
      category: 'code-quality',
      enabled: true,
      priority: 50,
      tags: ['code-quality', 'tracking'],
      scope: 'code',
    });

    this.engine.register({
      id: 'builtin-no-console-log',
      name: 'No console.log',
      description: 'Avoid console.log in production code',
      pattern: /console\.log\s*\(/,
      action: 'suggest',
      category: 'code-quality',
      enabled: true,
      priority: 80,
      tags: ['code-quality', 'logging'],
      scope: 'code',
    });
  }

  private async loadJsonFile(filePath: string): Promise<number> {
    const raw = await fs.readFile(filePath, 'utf-8');
    const rules = JSON.parse(raw) as Rule[];
    let count = 0;
    for (const rule of Array.isArray(rules) ? rules : [rules]) {
      this.engine.register(rule);
      count++;
    }
    return count;
  }

  private async loadMdFile(filePath: string): Promise<number> {
    const raw = await fs.readFile(filePath, 'utf-8');
    const rule = this.parseMdRule(raw);
    if (rule) {
      this.engine.register(rule);
      return 1;
    }
    return 0;
  }

  private parseMdRule(content: string): Rule | null {
    const lines = content.split('\n');
    const fields: Record<string, string> = {};

    for (const line of lines) {
      const match = line.match(/^(\w[\w-]*):\s*(.+)$/);
      if (match) {
        fields[match[1].toLowerCase()] = match[2].trim();
      }
    }

    if (!fields['id'] || !fields['name'] || !fields['pattern']) return null;

    return {
      id: fields['id'],
      name: fields['name'],
      description: fields['description'] ?? '',
      pattern: fields['pattern'],
      action: (fields['action'] as Rule['action']) ?? 'warn',
      category: fields['category'] ?? 'general',
      enabled: fields['enabled'] !== 'false',
      priority: fields['priority'] ? parseInt(fields['priority'], 10) : 100,
      tags: fields['tags'] ? fields['tags'].split(',').map(t => t.trim()) : [],
      scope: (fields['scope'] as Rule['scope']) ?? 'all',
    };
  }
}
