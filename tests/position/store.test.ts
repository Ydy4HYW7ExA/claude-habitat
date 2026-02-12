import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FilePositionStore, FileRoleTemplateStore } from '../../src/position/store.js';
import type { Position, RoleTemplate } from '../../src/position/types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { POSITION_STATUS } from '../../src/constants.js';

describe('FilePositionStore', () => {
  let tmpDir: string;
  let store: FilePositionStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pos-test-'));
    store = new FilePositionStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function makePosition(id: string): Position {
    return {
      id,
      roleTemplateName: 'coder',
      status: POSITION_STATUS.IDLE,
      sessionHistory: [],
      taskQueue: [],
      outputRoutes: [],
      workDir: path.join(tmpDir, 'positions', id),
      memoryDir: path.join(tmpDir, 'memory', id),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  it('should save and load a position', async () => {
    const pos = makePosition('coder-01');
    await store.save(pos);

    const loaded = await store.load('coder-01');
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('coder-01');
    expect(loaded!.roleTemplateName).toBe('coder');
  });

  it('should return null for non-existent position', async () => {
    const result = await store.load('nonexistent');
    expect(result).toBeNull();
  });

  it('should load all positions', async () => {
    await store.save(makePosition('pos-1'));
    await store.save(makePosition('pos-2'));

    const all = await store.loadAll();
    expect(all).toHaveLength(2);
    expect(all.map(p => p.id).sort()).toEqual(['pos-1', 'pos-2']);
  });

  it('should delete a position', async () => {
    await store.save(makePosition('pos-1'));
    await store.delete('pos-1');

    const result = await store.load('pos-1');
    expect(result).toBeNull();
  });

  it('should serialize output routes without functions', async () => {
    const pos = makePosition('pos-1');
    pos.outputRoutes = [{
      taskType: 'review',
      targetPositionId: 'reviewer-01',
      transform: (r) => r,
      condition: () => true,
    }];
    await store.save(pos);

    const loaded = await store.load('pos-1');
    expect(loaded!.outputRoutes[0].taskType).toBe('review');
    expect(loaded!.outputRoutes[0].targetPositionId).toBe('reviewer-01');
    // Functions are not serialized
    expect(loaded!.outputRoutes[0].transform).toBeUndefined();
    expect(loaded!.outputRoutes[0].condition).toBeUndefined();
  });
});

describe('FileRoleTemplateStore', () => {
  let tmpDir: string;
  let store: FileRoleTemplateStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'role-test-'));
    store = new FileRoleTemplateStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function makeTemplate(name: string): RoleTemplate {
    return {
      name,
      description: `${name} role template`,
      workflowPath: `workflows/${name}.ts`,
    };
  }

  it('should save and load a template', async () => {
    await store.save(makeTemplate('coder'));
    const loaded = await store.load('coder');
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('coder');
    expect(loaded!.workflowPath).toBe('workflows/coder.ts');
  });

  it('should return null for non-existent template', async () => {
    const result = await store.load('nonexistent');
    expect(result).toBeNull();
  });

  it('should load all templates', async () => {
    await store.save(makeTemplate('coder'));
    await store.save(makeTemplate('reviewer'));

    const all = await store.loadAll();
    expect(all).toHaveLength(2);
  });

  it('should delete a template', async () => {
    await store.save(makeTemplate('coder'));
    await store.delete('coder');

    const result = await store.load('coder');
    expect(result).toBeNull();
  });
});
