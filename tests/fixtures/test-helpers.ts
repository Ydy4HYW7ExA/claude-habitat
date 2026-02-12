/**
 * Shared test helpers and factories.
 * Eliminates duplication across attention strategy tests and other test files.
 */
import { vi } from 'vitest';
import {
  POSITION_STATUS, TASK_STATUS, TASK_PRIORITY, MEMORY_LAYER,
} from '../../src/constants.js';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AttentionInput, AttentionContext } from '../../src/attention/types.js';
import type { MemoryStore, MemoryEntry, MemoryLayer } from '../../src/memory/types.js';
import type { Position, RoleTemplate, Task } from '../../src/position/types.js';

/** Portable temp directory base for tests (never hardcode /tmp) */
export const TEST_BASE = path.join(os.tmpdir(), 'habitat-test');

/** Create a minimal mock MemoryStore */
export function mockMemoryStore(overrides?: Partial<MemoryStore>): MemoryStore {
  return {
    search: vi.fn(async () => []),
    searchByKeywords: vi.fn(async () => []),
    listByLayer: vi.fn(async () => []),
    write: vi.fn(async (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>) => ({
      ...entry, id: 'e-mock', createdAt: Date.now(), updatedAt: Date.now(),
    })),
    read: vi.fn(async () => null),
    update: vi.fn(async () => ({} as MemoryEntry)),
    delete: vi.fn(async () => {}),
    rewrite: vi.fn(async () => ({} as MemoryEntry)),
    getConsolidationCandidates: vi.fn(async () => []),
    consolidate: vi.fn(async () => ({} as MemoryEntry)),
    getStats: vi.fn(async () => ({
      totalEntries: 0, byLayer: { episode: 0, trace: 0, category: 0, insight: 0 },
      lastUpdated: Date.now(), indexSize: 0,
    })),
    ...overrides,
  } as unknown as MemoryStore;
}

/** Create a minimal test Position */
export function makePosition(overrides?: Partial<Position>): Position {
  return {
    id: 'coder-01',
    roleTemplateName: 'coder',
    status: POSITION_STATUS.IDLE,
    sessionHistory: [],
    taskQueue: [],
    outputRoutes: [],
    workDir: path.join(TEST_BASE, 'positions', 'coder-01'),
    memoryDir: path.join(TEST_BASE, 'memory', 'coder-01'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

/** Create a minimal test RoleTemplate */
export function makeRoleTemplate(overrides?: Partial<RoleTemplate>): RoleTemplate {
  return {
    name: 'coder',
    description: 'A coder role',
    workflowPath: 'workflows/coder.ts',
    ...overrides,
  };
}

/** Create a minimal test Task */
export function makeTask(overrides?: Partial<Task>): Task {
  return {
    id: 'task-001',
    sourcePositionId: 'orchestrator',
    targetPositionId: 'coder-01',
    type: 'implement',
    payload: { feature: 'login' },
    priority: TASK_PRIORITY.NORMAL,
    status: TASK_STATUS.RUNNING,
    createdAt: Date.now(),
    ...overrides,
  };
}

/** Create a minimal test MemoryEntry */
export function makeMemoryEntry(overrides?: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: 'e-test',
    layer: MEMORY_LAYER.EPISODE,
    content: 'test content',
    summary: 'test summary',
    keywords: ['test'],
    refs: [],
    metadata: { positionId: 'test' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

/** Create a minimal AttentionContext */
export function makeAttentionContext(overrides?: Partial<AttentionContext>): AttentionContext {
  const store = mockMemoryStore();
  return {
    position: makePosition(),
    roleTemplate: makeRoleTemplate(),
    task: makeTask(),
    memoryStore: store,
    globalMemoryStore: store,
    ...overrides,
  };
}

/** Create a minimal AttentionInput */
export function makeAttentionInput(
  prompt = 'Do something',
  contextOverrides?: Partial<AttentionContext>,
): AttentionInput {
  return {
    prompt,
    systemPromptAppend: '',
    context: makeAttentionContext(contextOverrides),
  };
}
