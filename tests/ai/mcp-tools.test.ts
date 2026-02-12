import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MemoryStore, MemoryEntry } from '../../src/memory/types.js';
import type { Process } from '../../src/position/types.js';
import { EventBus } from '../../src/orchestration/event-bus.js';
import {
  POSITION_STATUS, TASK_STATUS, MEMORY_LAYER, TOOL_NAME, EVENT_TYPE,
  DEFAULT_RECALL_LIMIT,
} from '../../src/constants.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * These tests verify the tool logic by calling createPositionMcpServer
 * and extracting the tool handlers from the returned MCP server.
 *
 * Since createPositionMcpServer uses dynamic import of the SDK,
 * we mock the SDK module to avoid requiring the real SDK in tests.
 */

// Mock the SDK's tool() and createSdkMcpServer()
vi.mock('@anthropic-ai/claude-agent-sdk', () => {
  // tool() just captures the handler and returns a descriptor
  const tool = (name: string, description: string, schema: any, handler: Function) => ({
    name,
    description,
    schema,
    handler,
  });

  // createSdkMcpServer() returns the tools as-is for testing
  const createSdkMcpServer = (config: any) => ({
    type: 'sdk',
    name: config.name,
    version: config.version,
    tools: config.tools,
  });

  return { tool, createSdkMcpServer };
});

vi.mock('zod/v4', () => {
  // Minimal zod mock that returns passthrough schemas
  const createSchema = () => ({
    optional: () => createSchema(),
    describe: () => createSchema(),
    min: () => createSchema(),
    max: () => createSchema(),
  });
  const z = {
    string: () => createSchema(),
    number: () => createSchema(),
    array: (inner: any) => createSchema(),
    enum: (values: string[]) => createSchema(),
    record: (key: any, value: any) => createSchema(),
    unknown: () => createSchema(),
  };
  return { z };
});

// Helper to extract a tool handler by name from the MCP server result
function getToolHandler(server: any, toolName: string): Function {
  const toolDef = server.tools.find((t: any) => t.name === toolName);
  if (!toolDef) throw new Error(`Tool '${toolName}' not found in server`);
  return toolDef.handler;
}

describe('Process MCP Tools (memory)', () => {
  let mockMemoryStore: MemoryStore;
  let mockGlobalStore: MemoryStore;
  let position: Process;
  let tmpDir: string;
  let eventBus: EventBus;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-tools-'));
    eventBus = new EventBus(tmpDir);

    mockMemoryStore = {
      write: vi.fn(async (entry: any) => ({
        ...entry,
        id: 'e-mock-001',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })),
      search: vi.fn(async () => [
        {
          id: 'e-found-001',
          layer: MEMORY_LAYER.EPISODE,
          content: 'Found memory content',
          summary: 'Found memory',
          keywords: ['test'],
          refs: [],
          metadata: { positionId: 'test' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]),
      delete: vi.fn(async () => {}),
      rewrite: vi.fn(async () => ({})),
    } as unknown as MemoryStore;

    mockGlobalStore = {
      write: vi.fn(async (entry: any) => ({
        ...entry,
        id: 'e-global-001',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })),
      search: vi.fn(async () => []),
    } as unknown as MemoryStore;

    position = {
      id: 'coder-01',
      programName: 'coder',
      status: POSITION_STATUS.IDLE,
      sessionHistory: [],
      taskQueue: [],
      outputRoutes: [],
      workDir: path.join(tmpDir, 'process', 'coder-01'),
      memoryDir: path.join(tmpDir, 'data', 'coder-01', 'memory'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as Process;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function getServer() {
    const { createPositionMcpServer } = await import('../../src/ai/mcp-tools.js');
    return createPositionMcpServer({
      memoryStore: mockMemoryStore,
      globalMemoryStore: mockGlobalStore,
      eventBus,
      position,
    });
  }

  it('should remember a new memory', async () => {
    const server = await getServer();
    const handler = getToolHandler(server, TOOL_NAME.REMEMBER);

    const result = await handler({
      content: 'Learned something new',
      keywords: ['learning'],
    });

    expect(result.content[0].text).toContain('e-mock-001');
    expect(mockMemoryStore.write).toHaveBeenCalledWith(
      expect.objectContaining({
        layer: MEMORY_LAYER.EPISODE,
        content: 'Learned something new',
        keywords: ['learning'],
      }),
    );
  });

  it('should recall memories', async () => {
    const server = await getServer();
    const handler = getToolHandler(server, TOOL_NAME.RECALL);

    const result = await handler({ query: 'test query' });

    expect(result.content[0].text).toContain('Found memory content');
    expect(mockMemoryStore.search).toHaveBeenCalledWith('test query', {
      layer: undefined,
      limit: DEFAULT_RECALL_LIMIT,
    });
  });

  it('should forget a memory', async () => {
    const server = await getServer();
    const handler = getToolHandler(server, TOOL_NAME.FORGET);

    const result = await handler({ id: 'e-001', reason: 'outdated' });

    expect(result.content[0].text).toContain('deleted');
    expect(mockMemoryStore.delete).toHaveBeenCalledWith('e-001');
  });

  it('should rewrite a memory', async () => {
    const server = await getServer();
    const handler = getToolHandler(server, TOOL_NAME.REWRITE_MEMORY);

    const result = await handler({
      id: 'e-001',
      newContent: 'Updated content',
    });

    expect(result.content[0].text).toContain('rewritten');
    expect(mockMemoryStore.rewrite).toHaveBeenCalled();
  });

  it('should recall from global store', async () => {
    const server = await getServer();
    const handler = getToolHandler(server, TOOL_NAME.RECALL_GLOBAL);

    await handler({ query: 'global query' });
    expect(mockGlobalStore.search).toHaveBeenCalledWith('global query', { limit: DEFAULT_RECALL_LIMIT });
  });

  it('should remember to global store', async () => {
    const server = await getServer();
    const handler = getToolHandler(server, TOOL_NAME.REMEMBER_GLOBAL);

    const result = await handler({
      content: 'Global fact',
      keywords: ['global'],
    });

    expect(result.content[0].text).toContain('e-global-001');
    expect(mockGlobalStore.write).toHaveBeenCalled();
  });
});

describe('Process MCP Tools (events)', () => {
  let tmpDir: string;
  let eventBus: EventBus;
  let position: Process;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'evt-tools-'));
    eventBus = new EventBus(tmpDir);
    position = {
      id: 'coder-01',
      taskQueue: [
        { id: 'task-1', status: TASK_STATUS.PENDING, type: 'implement', payload: {}, priority: 'normal', sourcePositionId: 'x', targetPositionId: 'coder-01', createdAt: Date.now() },
        { id: 'task-2', status: TASK_STATUS.RUNNING, type: 'review', payload: {}, priority: 'normal', sourcePositionId: 'x', targetPositionId: 'coder-01', createdAt: Date.now() },
      ],
    } as Process;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function getServer() {
    const { createPositionMcpServer } = await import('../../src/ai/mcp-tools.js');
    return createPositionMcpServer({
      memoryStore: { write: vi.fn(), search: vi.fn(), delete: vi.fn(), rewrite: vi.fn() } as unknown as MemoryStore,
      globalMemoryStore: { write: vi.fn(), search: vi.fn() } as unknown as MemoryStore,
      eventBus,
      position,
    });
  }

  it('should emit a task event', async () => {
    const received: any[] = [];
    eventBus.on('task.review', async (event) => { received.push(event); });

    const server = await getServer();
    const handler = getToolHandler(server, TOOL_NAME.EMIT_TASK);
    const result = await handler({
      taskType: 'review',
      payload: { files: ['a.ts'] },
      targetPositionId: 'reviewer-01',
    });

    expect(result.content[0].text).toContain('emitted');
    expect(received).toHaveLength(1);
    expect(received[0].payload).toEqual({ files: ['a.ts'] });
  });

  it('should get pending tasks', async () => {
    const server = await getServer();
    const handler = getToolHandler(server, TOOL_NAME.GET_MY_TASKS);
    const result = await handler({});

    const tasks = JSON.parse(result.content[0].text);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('task-1');
  });

  it('should report status', async () => {
    const received: any[] = [];
    eventBus.on(EVENT_TYPE.POSITION_STATUS_REPORT, async (event) => { received.push(event); });

    const server = await getServer();
    const handler = getToolHandler(server, TOOL_NAME.REPORT_STATUS);
    await handler({ status: 'working on feature', progress: 50 });

    expect(received).toHaveLength(1);
    expect(received[0].payload).toEqual({ status: 'working on feature', progress: 50 });
  });

  it('should submit a workflow change request', async () => {
    const received: any[] = [];
    eventBus.on(EVENT_TYPE.WORKFLOW_CHANGE_REQUEST, async (event) => { received.push(event); });

    const server = await getServer();
    const handler = getToolHandler(server, TOOL_NAME.REQUEST_WORKFLOW_CHANGE);
    const result = await handler({
      description: 'Add error handling step',
      suggestedCode: 'try { ... } catch { ... }',
      reason: 'Too many unhandled errors',
    });

    expect(result.content[0].text).toContain('submitted');
    expect(received).toHaveLength(1);
    expect(received[0].payload.description).toBe('Add error handling step');
    expect(received[0].payload.reason).toBe('Too many unhandled errors');
  });
});
