import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigLoader } from '../../src/domain/config/loader.js';
import { DEFAULT_CONFIG } from '../../src/domain/config/types.js';
import { ValidationError } from '../../src/infra/errors.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ConfigLoader', () => {
  let dir: string;
  let loader: ConfigLoader;

  beforeEach(async () => {
    dir = join(tmpdir(), `config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(dir, { recursive: true });
    loader = new ConfigLoader();
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('returns defaults when no config file', async () => {
    const config = await loader.load(dir);
    expect(config.version).toBe(DEFAULT_CONFIG.version);
    expect(config.logging?.level).toBe('info');
  });

  it('merges file config over defaults', async () => {
    await fs.writeFile(
      join(dir, 'config.json'),
      JSON.stringify({ logging: { level: 'debug' } }),
    );
    const config = await loader.load(dir);
    expect(config.logging?.level).toBe('debug');
    expect(config.security?.maxInputLength).toBe(100000);
  });

  it('ignores undefined values in override', async () => {
    await fs.writeFile(
      join(dir, 'config.json'),
      JSON.stringify({ logging: { level: 'debug' }, projectName: undefined }),
    );
    const config = await loader.load(dir);
    expect(config.logging?.level).toBe('debug');
  });

  it('deep merges nested object into missing base key', async () => {
    await fs.writeFile(
      join(dir, 'config.json'),
      JSON.stringify({ workflows: { maxDepth: 5 }, newSection: { nested: true } }),
    );
    const config = await loader.load(dir);
    expect(config.workflows?.maxDepth).toBe(5);
    expect((config as any).newSection?.nested).toBe(true);
  });

  it('ignores __proto__ key in merge', async () => {
    await fs.writeFile(
      join(dir, 'config.json'),
      '{"__proto__": {"polluted": true}}',
    );
    const config = await loader.load(dir);
    expect(({} as any).polluted).toBeUndefined();
    expect((config as any).polluted).toBeUndefined();
  });

  it('ignores constructor key in merge', async () => {
    await fs.writeFile(
      join(dir, 'config.json'),
      '{"constructor": {"polluted": true}}',
    );
    const config = await loader.load(dir);
    expect((config as any).constructor?.polluted).toBeUndefined();
  });

  it('ignores prototype key in merge', async () => {
    await fs.writeFile(
      join(dir, 'config.json'),
      '{"prototype": {"polluted": true}}',
    );
    const config = await loader.load(dir);
    expect((config as any).prototype).toBeUndefined();
  });

  it('saves and reloads config', async () => {
    const config = { ...DEFAULT_CONFIG, projectName: 'test' };
    await loader.save(dir, config);
    const loaded = await loader.load(dir);
    expect(loaded.projectName).toBe('test');
  });

  it('throws ValidationError for invalid JSON', async () => {
    await fs.writeFile(join(dir, 'config.json'), '{not valid json!!!');
    await expect(loader.load(dir)).rejects.toThrow(ValidationError);
    await expect(loader.load(dir)).rejects.toThrow('Invalid JSON');
  });

  describe('loadWithFallback', () => {
    let globalDir: string;
    let projectDir: string;

    beforeEach(async () => {
      globalDir = join(tmpdir(), `cfg-global-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      projectDir = join(tmpdir(), `cfg-project-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await fs.mkdir(globalDir, { recursive: true });
      await fs.mkdir(projectDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(globalDir, { recursive: true, force: true });
      await fs.rm(projectDir, { recursive: true, force: true });
    });

    it('returns defaults when neither config exists', async () => {
      const config = await loader.loadWithFallback(projectDir, globalDir);
      expect(config.version).toBe(DEFAULT_CONFIG.version);
      expect(config.logging?.level).toBe('info');
    });

    it('merges global config over defaults', async () => {
      await fs.writeFile(
        join(globalDir, 'config.json'),
        JSON.stringify({ logging: { level: 'warn' } }),
      );
      const config = await loader.loadWithFallback(projectDir, globalDir);
      expect(config.logging?.level).toBe('warn');
      expect(config.security?.maxInputLength).toBe(100000);
    });

    it('project config overrides global config', async () => {
      await fs.writeFile(
        join(globalDir, 'config.json'),
        JSON.stringify({ logging: { level: 'warn' }, projectName: 'global' }),
      );
      await fs.writeFile(
        join(projectDir, 'config.json'),
        JSON.stringify({ logging: { level: 'debug' } }),
      );
      const config = await loader.loadWithFallback(projectDir, globalDir);
      expect(config.logging?.level).toBe('debug');
      expect(config.projectName).toBe('global');
    });

    it('silently skips invalid global JSON', async () => {
      await fs.writeFile(join(globalDir, 'config.json'), '{broken!!!');
      const config = await loader.loadWithFallback(projectDir, globalDir);
      expect(config.version).toBe(DEFAULT_CONFIG.version);
    });

    it('throws ValidationError for invalid project JSON', async () => {
      await fs.writeFile(join(projectDir, 'config.json'), '{broken!!!');
      await expect(
        loader.loadWithFallback(projectDir, globalDir),
      ).rejects.toThrow(ValidationError);
    });

    it('three-layer merge: default → global → project', async () => {
      await fs.writeFile(
        join(globalDir, 'config.json'),
        JSON.stringify({
          promptAugmentor: { apiKey: 'global-key', model: 'global-model' },
        }),
      );
      await fs.writeFile(
        join(projectDir, 'config.json'),
        JSON.stringify({
          promptAugmentor: { model: 'project-model' },
        }),
      );
      const config = await loader.loadWithFallback(projectDir, globalDir);
      expect(config.promptAugmentor?.apiKey).toBe('global-key');
      expect(config.promptAugmentor?.model).toBe('project-model');
      expect(config.promptAugmentor?.enabled).toBe(true); // from DEFAULT_CONFIG
    });
  });
});
