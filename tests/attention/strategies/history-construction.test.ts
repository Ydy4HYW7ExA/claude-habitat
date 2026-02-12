import { describe, it, expect, vi } from 'vitest';
import { HistoryConstructionStrategy } from '../../../src/attention/strategies/history-construction.js';
import type { MemoryStore, MemoryEntry } from '../../../src/memory/types.js';
import { makeAttentionInput, makeMemoryEntry } from '../../fixtures/test-helpers.js';
import { MEMORY_LAYER } from '../../../src/constants.js';

function makeEntry(content: string, summary: string): MemoryEntry {
  return makeMemoryEntry({ content, summary });
}

function makeInputWithMemories(searchResults: MemoryEntry[], insightResults: MemoryEntry[] = []) {
  const mockStore = {
    search: vi.fn(async (_query: string, options?: { layer?: string }) => {
      if (options?.layer === MEMORY_LAYER.INSIGHT) return insightResults;
      return searchResults;
    }),
  } as unknown as MemoryStore;

  return makeAttentionInput('Do something', {
    memoryStore: mockStore,
    globalMemoryStore: mockStore,
  });
}

describe('HistoryConstructionStrategy', () => {
  const strategy = new HistoryConstructionStrategy(6);

  it('should have correct name and priority', () => {
    expect(strategy.name).toBe('history-construction');
    expect(strategy.priority).toBe(40);
  });

  it('should construct virtual history from failure memories', async () => {
    const failures = [
      makeEntry('Tried approach X but it failed due to Y', 'Approach X failed'),
    ];

    const result = await strategy.enhance(makeInputWithMemories(failures));

    expect(result.conversationHistory).toBeDefined();
    expect(result.conversationHistory!.length).toBeGreaterThan(0);
    expect(result.conversationHistory!.some(t => t.content.includes('Tried approach X'))).toBe(true);
  });

  it('should inject insights as self-knowledge', async () => {
    const insights = [
      makeEntry('Always use dependency injection for testability', 'DI best practice'),
    ];

    const result = await strategy.enhance(makeInputWithMemories([], insights));

    expect(result.conversationHistory).toBeDefined();
    expect(result.conversationHistory!.some(t => t.content.includes('dependency injection'))).toBe(true);
  });

  it('should respect maxHistoryTurns limit', async () => {
    const manyFailures = Array.from({ length: 10 }, (_, i) =>
      makeEntry(`Failure ${i}`, `Summary ${i}`)
    );

    const result = await strategy.enhance(makeInputWithMemories(manyFailures));

    // Each failure creates 2 turns, max is 6
    expect(result.conversationHistory!.length).toBeLessThanOrEqual(6);
  });

  it('should return input unchanged when no memories found', async () => {
    const result = await strategy.enhance(makeInputWithMemories([]));
    expect(result.conversationHistory).toBeUndefined();
    expect(result.prompt).toBe('Do something');
  });

  it('should preserve existing conversation history', async () => {
    const input = makeInputWithMemories([makeEntry('failure', 'fail')]);
    input.conversationHistory = [
      { role: 'user', content: 'existing' },
      { role: 'assistant', content: 'response' },
    ];

    const result = await strategy.enhance(input);
    expect(result.conversationHistory![0].content).toBe('existing');
  });

  it('should inject cross-position insights from global memory store', async () => {
    const globalInsights = [
      makeEntry('Global best practice: always write tests first', 'TDD insight'),
    ];

    const mockPositionStore = {
      search: vi.fn(async () => []),
    } as unknown as MemoryStore;

    const mockGlobalStore = {
      search: vi.fn(async (_query: string, options?: { layer?: string }) => {
        if (options?.layer === MEMORY_LAYER.INSIGHT) return globalInsights;
        return [];
      }),
    } as unknown as MemoryStore;

    const input = makeAttentionInput('Do something', {
      memoryStore: mockPositionStore,
      globalMemoryStore: mockGlobalStore,
    });

    const result = await strategy.enhance(input);

    expect(result.conversationHistory).toBeDefined();
    expect(result.conversationHistory!.some(t => t.content.includes('always write tests first'))).toBe(true);
  });
});
