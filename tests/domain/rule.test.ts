import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RuleEngine } from '../../src/domain/rule/engine.js';
import { RuleLoader } from '../../src/domain/rule/loader.js';
import { Logger } from '../../src/logging/logger.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('RuleEngine', () => {
  it('registers and evaluates rules', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'r1',
      name: 'No TODO',
      description: 'Avoid TODO comments',
      pattern: /TODO/i,
      action: 'warn',
      category: 'code',
      enabled: true,
    });
    const matches = engine.evaluate('// TODO: fix this');
    expect(matches).toHaveLength(1);
    expect(matches[0].ruleName).toBe('No TODO');
  });

  it('skips disabled rules', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'r1', name: 'X', description: 'x',
      pattern: /x/, action: 'warn', category: 'a', enabled: false,
    });
    expect(engine.evaluate('x')).toHaveLength(0);
  });

  it('filters by category', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'r1', name: 'A', description: 'a',
      pattern: /a/, action: 'warn', category: 'cat1', enabled: true,
    });
    engine.register({
      id: 'r2', name: 'B', description: 'b',
      pattern: /a/, action: 'warn', category: 'cat2', enabled: true,
    });
    expect(engine.evaluate('a', 'cat1')).toHaveLength(1);
  });

  it('unregisters rules', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'r1', name: 'A', description: 'a',
      pattern: /a/, action: 'warn', category: 'a', enabled: true,
    });
    engine.unregister('r1');
    expect(engine.getAll()).toHaveLength(0);
  });

  // --- New: priority ---
  it('assigns default priority of 100', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'r1', name: 'A', description: 'a',
      pattern: /a/, action: 'warn', category: 'a', enabled: true,
    });
    const rule = engine.get('r1')!;
    expect(rule.priority).toBe(100);
  });

  it('sorts results by priority (lowest first)', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'r1', name: 'Low', description: 'low priority',
      pattern: /x/, action: 'warn', category: 'a', enabled: true,
      priority: 200, tags: [], scope: 'all',
    });
    engine.register({
      id: 'r2', name: 'High', description: 'high priority',
      pattern: /x/, action: 'error', category: 'a', enabled: true,
      priority: 10, tags: [], scope: 'all',
    });
    engine.register({
      id: 'r3', name: 'Mid', description: 'mid priority',
      pattern: /x/, action: 'suggest', category: 'a', enabled: true,
      priority: 50, tags: [], scope: 'all',
    });
    const matches = engine.evaluate('x');
    expect(matches).toHaveLength(3);
    expect(matches[0].ruleName).toBe('High');
    expect(matches[1].ruleName).toBe('Mid');
    expect(matches[2].ruleName).toBe('Low');
    expect(matches[0].priority).toBe(10);
  });

  // --- New: scope filtering ---
  it('filters by scope', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'r1', name: 'Code Only', description: 'code',
      pattern: /x/, action: 'warn', category: 'a', enabled: true,
      priority: 100, tags: [], scope: 'code',
    });
    engine.register({
      id: 'r2', name: 'All Scope', description: 'all',
      pattern: /x/, action: 'warn', category: 'a', enabled: true,
      priority: 100, tags: [], scope: 'all',
    });
    engine.register({
      id: 'r3', name: 'Doc Only', description: 'doc',
      pattern: /x/, action: 'warn', category: 'a', enabled: true,
      priority: 100, tags: [], scope: 'document',
    });
    const codeMatches = engine.evaluate('x', undefined, 'code');
    expect(codeMatches).toHaveLength(2); // code + all
    const docMatches = engine.evaluate('x', undefined, 'document');
    expect(docMatches).toHaveLength(2); // document + all
  });

  // --- New: default tags and scope ---
  it('assigns default tags and scope', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'r1', name: 'A', description: 'a',
      pattern: /a/, action: 'warn', category: 'a', enabled: true,
    });
    const rule = engine.get('r1')!;
    expect(rule.tags).toEqual([]);
    expect(rule.scope).toBe('all');
  });

  // --- New: string pattern matching ---
  it('matches string patterns via includes()', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'r1', name: 'Console', description: 'no console',
      pattern: 'console.log', action: 'warn', category: 'a', enabled: true,
    });
    const matches = engine.evaluate('foo console.log("hi") bar');
    expect(matches).toHaveLength(1);
  });

  it('handles invalid regex string pattern with logger', () => {
    const logger = new Logger({ level: 'debug' });
    const engine = new RuleEngine(logger);
    engine.register({
      id: 'r1', name: 'Bad Regex', description: 'invalid',
      pattern: '[invalid', action: 'warn', category: 'a', enabled: true,
    });
    const matches = engine.evaluate('some text');
    expect(matches).toHaveLength(0);
  });

  it('handles invalid regex string pattern gracefully', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'r1', name: 'Bad Regex', description: 'invalid',
      pattern: '[invalid', action: 'warn', category: 'a', enabled: true,
    });
    // '[invalid' is not a valid regex and doesn't match via includes
    const matches = engine.evaluate('some text');
    expect(matches).toHaveLength(0);
  });

  it('falls back to regex for string patterns', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'r1', name: 'TODO', description: 'todo',
      pattern: 'TODO|FIXME', action: 'warn', category: 'a', enabled: true,
    });
    const matches = engine.evaluate('// FIXME: broken');
    expect(matches).toHaveLength(1);
  });
});

describe('RuleLoader', () => {
  let dir: string;

  beforeEach(async () => {
    dir = join(tmpdir(), `rule-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('loads JSON rule files', async () => {
    const engine = new RuleEngine();
    const loader = new RuleLoader(engine);
    await fs.writeFile(
      join(dir, 'rules.json'),
      JSON.stringify([{
        id: 'j1', name: 'JSON Rule', description: 'from json',
        pattern: 'test', action: 'warn', category: 'test', enabled: true,
        priority: 50, tags: ['json'], scope: 'code',
      }]),
    );
    const count = await loader.loadFromDir(dir);
    expect(count).toBe(1);
    expect(engine.getAll()).toHaveLength(1);
  });

  it('loads .md rule files', async () => {
    const engine = new RuleEngine();
    const loader = new RuleLoader(engine);
    await fs.writeFile(
      join(dir, 'rule.md'),
      [
        'id: md1',
        'name: MD Rule',
        'description: from markdown',
        'pattern: console\\.log',
        'action: suggest',
        'category: quality',
        'priority: 75',
        'tags: logging, debug',
        'scope: code',
      ].join('\n'),
    );
    const count = await loader.loadFromDir(dir);
    expect(count).toBe(1);
    const rule = engine.get('md1')!;
    expect(rule.name).toBe('MD Rule');
    expect(rule.priority).toBe(75);
    expect(rule.tags).toEqual(['logging', 'debug']);
    expect(rule.scope).toBe('code');
  });

  it('loadFromDirs loads from multiple directories', async () => {
    const dir2 = join(tmpdir(), `rule-test2-${Date.now()}`);
    await fs.mkdir(dir2, { recursive: true });
    const engine = new RuleEngine();
    const loader = new RuleLoader(engine);

    await fs.writeFile(
      join(dir, 'a.json'),
      JSON.stringify({ id: 'a1', name: 'A', description: 'a',
        pattern: 'a', action: 'warn', category: 'a', enabled: true }),
    );
    await fs.writeFile(
      join(dir2, 'b.json'),
      JSON.stringify({ id: 'b1', name: 'B', description: 'b',
        pattern: 'b', action: 'warn', category: 'b', enabled: true }),
    );

    const total = await loader.loadFromDirs([dir, dir2]);
    expect(total).toBe(2);
    expect(engine.getAll()).toHaveLength(2);

    await fs.rm(dir2, { recursive: true, force: true });
  });

  it('returns 0 for nonexistent directory', async () => {
    const engine = new RuleEngine();
    const loader = new RuleLoader(engine);
    const count = await loader.loadFromDir('/nonexistent-dir-xyz');
    expect(count).toBe(0);
  });

  it('loadBuiltins registers 3 built-in rules', () => {
    const engine = new RuleEngine();
    const loader = new RuleLoader(engine);
    loader.loadBuiltins();
    const rules = engine.getAll();
    expect(rules).toHaveLength(3);
    const ids = rules.map(r => r.id);
    expect(ids).toContain('builtin-no-hardcoded-secrets');
    expect(ids).toContain('builtin-todo-markers');
    expect(ids).toContain('builtin-no-console-log');
  });

  it('builtin secrets rule detects hardcoded passwords', () => {
    const engine = new RuleEngine();
    const loader = new RuleLoader(engine);
    loader.loadBuiltins();
    const matches = engine.evaluate('const password = "secret123"');
    expect(matches.some(m => m.ruleId === 'builtin-no-hardcoded-secrets')).toBe(true);
  });

  it('builtin TODO rule detects TODO markers', () => {
    const engine = new RuleEngine();
    const loader = new RuleLoader(engine);
    loader.loadBuiltins();
    const matches = engine.evaluate('// TODO: fix this later');
    expect(matches.some(m => m.ruleId === 'builtin-todo-markers')).toBe(true);
  });

  it('returns 0 for .md file missing required fields', async () => {
    const engine = new RuleEngine();
    const loader = new RuleLoader(engine);
    await fs.writeFile(
      join(dir, 'bad.md'),
      'description: no id or name or pattern\n',
    );
    const count = await loader.loadFromDir(dir);
    expect(count).toBe(0);
    expect(engine.getAll()).toHaveLength(0);
  });

  it('loads .md rule with minimal fields using defaults', async () => {
    const engine = new RuleEngine();
    const loader = new RuleLoader(engine);
    await fs.writeFile(
      join(dir, 'minimal.md'),
      'id: min1\nname: Minimal\npattern: foo\n',
    );
    const count = await loader.loadFromDir(dir);
    expect(count).toBe(1);
    const rule = engine.get('min1')!;
    expect(rule.name).toBe('Minimal');
    expect(rule.category).toBe('general');
    expect(rule.enabled).toBe(true);
  });

  it('loads .md rule with enabled=false', async () => {
    const engine = new RuleEngine();
    const loader = new RuleLoader(engine);
    await fs.writeFile(
      join(dir, 'disabled.md'),
      'id: dis1\nname: Disabled\npattern: bar\nenabled: false\n',
    );
    const count = await loader.loadFromDir(dir);
    expect(count).toBe(1);
    const rule = engine.get('dis1')!;
    expect(rule.enabled).toBe(false);
  });

  it('builtin console.log rule detects console.log', () => {
    const engine = new RuleEngine();
    const loader = new RuleLoader(engine);
    loader.loadBuiltins();
    const matches = engine.evaluate('console.log("debug")');
    expect(matches.some(m => m.ruleId === 'builtin-no-console-log')).toBe(true);
  });
});
