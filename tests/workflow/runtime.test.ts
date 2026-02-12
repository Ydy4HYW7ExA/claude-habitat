import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowRuntime, type AiCaller, type WorkflowRuntimeConfig } from '../../src/workflow/runtime.js';
import { AttentionEnhancer } from '../../src/attention/enhancer.js';
import { EventBus } from '../../src/orchestration/event-bus.js';
import { ProcessManager } from '../../src/position/manager.js';
import type { MemoryStore, MemoryEntry } from '../../src/memory/types.js';
import type { Process, Program, Task } from '../../src/position/types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { POSITION_STATUS, TASK_STATUS, TASK_PRIORITY } from '../../src/constants.js';

declare const globalThis: Record<string, unknown>;

// Mock SDK to avoid real SDK dependency in buildMcpServers
vi.mock('@anthropic-ai/claude-agent-sdk', () => {
  const tool = (name: string, description: string, schema: unknown, handler: Function) => ({
    name, description, schema, handler,
  });
  const createSdkMcpServer = (config: Record<string, unknown>) => ({
    type: 'sdk', name: config.name, version: config.version, tools: config.tools,
  });
  return { tool, createSdkMcpServer };
});

vi.mock('zod/v4', () => {
  const createSchema = () => ({
    optional: () => createSchema(),
    describe: () => createSchema(),
    min: () => createSchema(),
    max: () => createSchema(),
  });
  const z = {
    string: () => createSchema(),
    number: () => createSchema(),
    array: (_inner: unknown) => createSchema(),
    enum: (_values: string[]) => createSchema(),
    record: (_key: unknown, _value: unknown) => createSchema(),
    unknown: () => createSchema(),
  };
  return { z };
});

describe('WorkflowRuntime', () => {
  let tmpDir: string;
  let runtime: WorkflowRuntime;
  let mockAiCaller: AiCaller;
  let emitCalls: unknown[];
  let callResults: Map<string, unknown>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wf-runtime-'));
    emitCalls = [];
    callResults = new Map();

    mockAiCaller = {
      call: vi.fn(async () => ({
        text: 'AI did the thing',
        sessionId: 'sess-001',
        costUsd: 0.05,
        durationMs: 2000,
        numTurns: 3,
        status: 'success' as const,
      })),
    };

    const mockMemoryStore = {
      write: vi.fn(async (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>) => ({ ...entry, id: 'e-mock', createdAt: Date.now(), updatedAt: Date.now() })),
      search: vi.fn(async () => []),
      delete: vi.fn(async () => {}),
      rewrite: vi.fn(async () => ({})),
    } as unknown as MemoryStore;

    const eventBus = new EventBus(tmpDir);
    const positionManager = new ProcessManager(tmpDir);

    const config: WorkflowRuntimeConfig = {
      projectRoot: tmpDir,
      aiCaller: mockAiCaller,
      attentionEnhancer: new AttentionEnhancer(),
      memoryStoreGetter: () => mockMemoryStore,
      globalMemoryStore: mockMemoryStore,
      eventBus,
      positionManager,
      emitFn: vi.fn(async (...args: unknown[]) => { emitCalls.push(args); }),
      callFn: vi.fn(async (targetId: string) => callResults.get(targetId) ?? null),
      logger: vi.fn(),
    };

    runtime = new WorkflowRuntime(config);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeWorkflow(name: string, code: string): Promise<string> {
    const filePath = path.join(tmpDir, name);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, code);
    return name;
  }

  function makeProcess(workflowPath?: string): Process {
    return {
      id: 'coder-01',
      programName: 'coder',
      status: POSITION_STATUS.BUSY,
      sessionHistory: [],
      taskQueue: [],
      outputRoutes: [],
      workDir: path.join(tmpDir, 'process', 'coder-01'),
      memoryDir: path.join(tmpDir, 'data', 'coder-01', 'memory'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      config: workflowPath ? { workflowPath, name: 'coder', description: '', } : undefined,
    } as Process;
  }

  const roleTemplate: Program = {
    name: 'coder',
    description: 'A coder',
    workflowPath: 'default.mjs',
  };

  function makeTask(): Task {
    return {
      id: 'task-001',
      sourcePositionId: 'orchestrator',
      targetPositionId: 'coder-01',
      type: 'implement',
      payload: { feature: 'login' },
      priority: TASK_PRIORITY.NORMAL,
      status: TASK_STATUS.RUNNING,
      createdAt: Date.now(),
    };
  }

  it('should execute a simple workflow', async () => {
    const wfPath = await writeWorkflow('simple.mjs', `
      export default async function(ctx) {
        const result = await ctx.ai('implement login');
        await ctx.memory.remember('implemented login');
      }
    `);

    await runtime.execute(
      makeProcess(wfPath),
      roleTemplate,
      makeTask(),
    );

    expect(mockAiCaller.call).toHaveBeenCalled();
  });

  it('should pass task args through context', async () => {
    let capturedArgs: unknown;
    const wfPath = await writeWorkflow('args.mjs', `
      export default async function(ctx) {
        globalThis.__capturedArgs = ctx.args;
      }
    `);

    await runtime.execute(makeProcess(wfPath), roleTemplate, makeTask());

    // The workflow sets globalThis.__capturedArgs
    expect(globalThis.__capturedArgs).toEqual({ feature: 'login' });
    delete globalThis.__capturedArgs;
  });

  it('should use position config workflowPath override', async () => {
    const wfPath = await writeWorkflow('override.mjs', `
      export default async function(ctx) {
        globalThis.__overrideRan = true;
      }
    `);

    await runtime.execute(makeProcess(wfPath), roleTemplate, makeTask());
    expect(globalThis.__overrideRan).toBe(true);
    delete globalThis.__overrideRan;
  });

  it('should support abort controller', async () => {
    const wfPath = await writeWorkflow('abort.mjs', `
      export default async function(ctx) {
        if (ctx.signal.aborted) {
          globalThis.__aborted = true;
        }
      }
    `);

    const ac = new AbortController();
    ac.abort();

    await runtime.execute(makeProcess(wfPath), roleTemplate, makeTask(), ac);
    expect(globalThis.__aborted).toBe(true);
    delete globalThis.__aborted;
  });
});
