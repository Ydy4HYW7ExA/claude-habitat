import { describe, it, expect, vi } from 'vitest';
import { MemoryRetrievalStrategy } from '../../../src/attention/strategies/memory-retrieval.js';
import { makeAttentionInput, makeMemoryEntry } from '../../fixtures/test-helpers.js';
import { MEMORY_LAYER, PROMPT } from '../../../src/constants.js';
function makeEntry(layer, content, keywords) {
    return makeMemoryEntry({
        id: `${layer[0]}-test`,
        layer,
        content,
        summary: content.slice(0, 50),
        keywords,
    });
}
function makeInputWithMemories(positionEntries, globalEntries) {
    const mockPositionStore = {
        search: vi.fn(async (_query, options) => {
            return positionEntries.filter(e => !options?.layer || e.layer === options.layer);
        }),
    };
    const mockGlobalStore = {
        search: vi.fn(async () => globalEntries),
    };
    return makeAttentionInput('implement login feature', {
        memoryStore: mockPositionStore,
        globalMemoryStore: mockGlobalStore,
    });
}
describe('MemoryRetrievalStrategy', () => {
    const strategy = new MemoryRetrievalStrategy(5);
    it('should have correct name and priority', () => {
        expect(strategy.name).toBe('memory-retrieval');
        expect(strategy.priority).toBe(30);
    });
    it('should inject memories into prompt', async () => {
        const entries = [
            makeEntry(MEMORY_LAYER.INSIGHT, 'Always validate user input', ['validation', 'security']),
            makeEntry(MEMORY_LAYER.EPISODE, 'Used bcrypt for password hashing', ['auth', 'security']),
        ];
        const result = await strategy.enhance(makeInputWithMemories(entries, []));
        expect(result.prompt).toContain(PROMPT.MEMORY_SECTION_HEADER);
        expect(result.prompt).toContain('Always validate user input');
        expect(result.prompt).toContain('Used bcrypt for password hashing');
    });
    it('should include global memories', async () => {
        const globalEntries = [
            makeEntry(MEMORY_LAYER.CATEGORY, 'Project uses Express.js', ['express', 'framework']),
        ];
        const result = await strategy.enhance(makeInputWithMemories([], globalEntries));
        expect(result.prompt).toContain('Project uses Express.js');
    });
    it('should not modify prompt when no memories found', async () => {
        const result = await strategy.enhance(makeInputWithMemories([], []));
        expect(result.prompt).toBe('implement login feature');
    });
    it('should deduplicate entries by ID', async () => {
        const shared = makeEntry(MEMORY_LAYER.EPISODE, 'Shared memory unique marker XYZ', ['shared']);
        shared.id = 'e-shared-001';
        const mockPositionStore = {
            search: vi.fn(async () => [shared]),
        };
        const mockGlobalStore = {
            search: vi.fn(async () => [shared]),
        };
        const input = makeAttentionInput('test query', {
            memoryStore: mockPositionStore,
            globalMemoryStore: mockGlobalStore,
        });
        const result = await strategy.enhance(input);
        // The entry should appear exactly once in the formatted output.
        const sectionHeaders = result.prompt.match(/### \[/g);
        expect(sectionHeaders).toHaveLength(1);
    });
});
//# sourceMappingURL=memory-retrieval.test.js.map