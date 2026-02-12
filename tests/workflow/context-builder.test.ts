import { describe, it, expect, vi } from 'vitest';
import { buildWorkflowContext, type WorkflowDependencies } from '../../src/workflow/context-builder.js';
import type { MemoryEntry } from '../../src/memory/types.js';
import { TEST_BASE, mockMemoryStore, makeProcess, makeProgram, makeTask } from '../fixtures/test-helpers.js';
import { MEMORY_LAYER } from '../../src/constants.js';
import * as path from 'node:path';

function makeDeps(overrides?: Partial<WorkflowDependencies>): WorkflowDependencies {
  const store = mockMemoryStore({
    write: vi.fn(async (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>) => ({
      ...entry, id: 'e-mock', createdAt: Date.now(), updatedAt: Date.now(),
    })),
    rewrite: vi.fn(async (_id: string, content: string, summary: string, keywords: string[]) => ({
      id: 'e-mock', layer: MEMORY_LAYER.EPISODE, content, summary, keywords, refs: [],
      metadata: { positionId: 'test' }, createdAt: Date.now(), updatedAt: Date.now(),
    })),
  });

  return {
    position: makeProcess(),
    roleTemplate: makeProgram(),
    task: makeTask(),
    projectRoot: path.join(TEST_BASE, 'project'),
    memoryStore: store,
    globalMemoryStore: store,
    aiCall: vi.fn(async () => ({
      text: 'AI response',
      sessionId: 'session-001',
      costUsd: 0.01,
      durationMs: 1000,
      numTurns: 1,
      status: 'success' as const,
    })),
    emitFn: vi.fn(async () => {}),
    callFn: vi.fn(async () => 'call result'),
    signal: new AbortController().signal,
    logger: vi.fn(),
    ...overrides,
  };
}

describe('buildWorkflowContext', () => {
  it('should build a context with all required fields', () => {
    const deps = makeDeps();
    const ctx = buildWorkflowContext(deps);

    expect(ctx.position.id).toBe('coder-01');
    expect(ctx.roleTemplate.name).toBe('coder');
    expect(ctx.task.id).toBe('task-001');
    expect(ctx.projectRoot).toBe(path.join(TEST_BASE, 'project'));
    expect(ctx.args).toEqual({ feature: 'login' });
    expect(typeof ctx.ai).toBe('function');
    expect(typeof ctx.emit).toBe('function');
    expect(typeof ctx.call).toBe('function');
    expect(typeof ctx.log).toBe('function');
  });

  it('should delegate ai() to aiCall', async () => {
    const deps = makeDeps();
    const ctx = buildWorkflowContext(deps);

    const result = await ctx.ai('hello');
    expect(deps.aiCall).toHaveBeenCalled();
    expect(vi.mocked(deps.aiCall).mock.calls[0][0]).toBe('hello');
    expect(result.text).toBe('AI response');
  });

  it('should delegate emit() to emitFn', async () => {
    const deps = makeDeps();
    const ctx = buildWorkflowContext(deps);

    await ctx.emit('review', { files: ['a.ts'] }, 'reviewer-01');
    expect(deps.emitFn).toHaveBeenCalledWith('review', { files: ['a.ts'] }, 'reviewer-01');
  });

  it('should delegate call() to callFn', async () => {
    const deps = makeDeps();
    const ctx = buildWorkflowContext(deps);

    const result = await ctx.call('reviewer-01', 'review', { files: [] });
    expect(deps.callFn).toHaveBeenCalledWith('reviewer-01', 'review', { files: [] });
    expect(result).toBe('call result');
  });

  describe('memory helpers', () => {
    it('should remember via memoryStore.write', async () => {
      const deps = makeDeps();
      const ctx = buildWorkflowContext(deps);

      const id = await ctx.memory.remember('learned something', ['learning']);
      expect(deps.memoryStore.write).toHaveBeenCalled();
      expect(id).toBe('e-mock');
    });

    it('should recall via memoryStore.search', async () => {
      const deps = makeDeps();
      const ctx = buildWorkflowContext(deps);

      await ctx.memory.recall('something', 3);
      expect(deps.memoryStore.search).toHaveBeenCalledWith('something', { limit: 3 });
    });

    it('should forget via memoryStore.delete', async () => {
      const deps = makeDeps();
      const ctx = buildWorkflowContext(deps);

      await ctx.memory.forget('e-001', 'no longer relevant');
      expect(deps.memoryStore.delete).toHaveBeenCalledWith('e-001');
    });

    it('should rewrite via memoryStore.rewrite', async () => {
      const deps = makeDeps();
      const ctx = buildWorkflowContext(deps);

      await ctx.memory.rewrite('e-001', 'new content');
      expect(deps.memoryStore.rewrite).toHaveBeenCalled();
    });

    it('should recallGlobal via globalMemoryStore.search', async () => {
      const deps = makeDeps();
      const ctx = buildWorkflowContext(deps);

      await ctx.memory.recallGlobal('global query');
      expect(deps.globalMemoryStore.search).toHaveBeenCalledWith('global query', { limit: 5 });
    });

    it('should rememberGlobal via globalMemoryStore.write', async () => {
      const deps = makeDeps();
      const ctx = buildWorkflowContext(deps);

      await ctx.memory.rememberGlobal('global fact', ['global']);
      expect(deps.globalMemoryStore.write).toHaveBeenCalled();
    });
  });

  it('should expose signal from AbortController', () => {
    const ac = new AbortController();
    const deps = makeDeps({ signal: ac.signal });
    const ctx = buildWorkflowContext(deps);

    expect(ctx.signal).toBe(ac.signal);
    expect(ctx.signal.aborted).toBe(false);
  });

  it('should delegate log to logger', () => {
    const deps = makeDeps();
    const ctx = buildWorkflowContext(deps);

    ctx.log('info', 'test message');
    expect(deps.logger).toHaveBeenCalledWith('info', 'test message');
  });

  describe('askUser', () => {
    it('should delegate to aiCall with a question prompt', async () => {
      const deps = makeDeps();
      const ctx = buildWorkflowContext(deps);

      const answer = await ctx.askUser('What color?');
      expect(deps.aiCall).toHaveBeenCalled();
      const prompt = vi.mocked(deps.aiCall).mock.calls[0][0];
      expect(prompt).toContain('What color?');
      expect(answer).toBe('AI response');
    });
  });

  describe('parallel', () => {
    it('should execute multiple ai() calls concurrently', async () => {
      const deps = makeDeps();
      const ctx = buildWorkflowContext(deps);

      const results = await ctx.parallel([
        { prompt: 'task A' },
        { prompt: 'task B' },
        { prompt: 'task C' },
      ]);

      expect(results).toHaveLength(3);
      expect(deps.aiCall).toHaveBeenCalledTimes(3);
      expect(results.every(r => r.status === 'success')).toBe(true);
    });
  });

  describe('todo', () => {
    it('should add and list todo items', () => {
      const deps = makeDeps();
      const ctx = buildWorkflowContext(deps);

      ctx.todo.add('Write tests');
      ctx.todo.add('Implement feature');

      const items = ctx.todo.list();
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({ text: 'Write tests', done: false });
      expect(items[1]).toEqual({ text: 'Implement feature', done: false });
    });

    it('should complete todo items', () => {
      const deps = makeDeps();
      const ctx = buildWorkflowContext(deps);

      ctx.todo.add('Write tests');
      ctx.todo.add('Implement feature');
      ctx.todo.complete('Write tests');

      const items = ctx.todo.list();
      expect(items[0]).toEqual({ text: 'Write tests', done: true });
      expect(items[1]).toEqual({ text: 'Implement feature', done: false });
    });

    it('should return a copy of the list (not a reference)', () => {
      const deps = makeDeps();
      const ctx = buildWorkflowContext(deps);

      ctx.todo.add('item');
      const list1 = ctx.todo.list();
      const list2 = ctx.todo.list();
      expect(list1).not.toBe(list2);
      expect(list1).toEqual(list2);
    });
  });
});
