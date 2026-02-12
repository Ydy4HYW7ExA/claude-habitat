/**
 * Shared test helpers and factories.
 * Eliminates duplication across attention strategy tests and other test files.
 */
import { vi } from 'vitest';
import { POSITION_STATUS, TASK_STATUS, TASK_PRIORITY, MEMORY_LAYER, } from '../../src/constants.js';
import * as os from 'node:os';
import * as path from 'node:path';
/** Portable temp directory base for tests (never hardcode /tmp) */
export const TEST_BASE = path.join(os.tmpdir(), 'habitat-test');
/** Create a minimal mock MemoryStore */
export function mockMemoryStore(overrides) {
    return {
        search: vi.fn(async () => []),
        searchByKeywords: vi.fn(async () => []),
        listByLayer: vi.fn(async () => []),
        write: vi.fn(async (entry) => ({
            ...entry, id: 'e-mock', createdAt: Date.now(), updatedAt: Date.now(),
        })),
        read: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
        delete: vi.fn(async () => { }),
        rewrite: vi.fn(async () => ({})),
        getConsolidationCandidates: vi.fn(async () => []),
        consolidate: vi.fn(async () => ({})),
        getStats: vi.fn(async () => ({
            totalEntries: 0, byLayer: { episode: 0, trace: 0, category: 0, insight: 0 },
            lastUpdated: Date.now(), indexSize: 0,
        })),
        ...overrides,
    };
}
/** Create a minimal test Process */
export function makeProcess(overrides) {
    return {
        id: 'coder-01',
        programName: 'coder',
        status: POSITION_STATUS.IDLE,
        sessionHistory: [],
        taskQueue: [],
        outputRoutes: [],
        workDir: path.join(TEST_BASE, 'process', 'coder-01'),
        memoryDir: path.join(TEST_BASE, 'data', 'coder-01', 'memory'),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...overrides,
    };
}
/** Create a minimal test Program */
export function makeProgram(overrides) {
    return {
        name: 'coder',
        description: 'A coder role',
        workflowPath: 'program/app/coder/workflow.mjs',
        ...overrides,
    };
}
/** Create a minimal test Task */
export function makeTask(overrides) {
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
export function makeMemoryEntry(overrides) {
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
export function makeAttentionContext(overrides) {
    const store = mockMemoryStore();
    return {
        position: makeProcess(),
        roleTemplate: makeProgram(),
        task: makeTask(),
        memoryStore: store,
        globalMemoryStore: store,
        ...overrides,
    };
}
/** Create a minimal AttentionInput */
export function makeAttentionInput(prompt = 'Do something', contextOverrides) {
    return {
        prompt,
        systemPromptAppend: '',
        context: makeAttentionContext(contextOverrides),
    };
}
//# sourceMappingURL=test-helpers.js.map