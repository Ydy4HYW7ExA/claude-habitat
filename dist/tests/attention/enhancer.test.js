import { describe, it, expect, beforeEach } from 'vitest';
import { AttentionEnhancer } from '../../src/attention/enhancer.js';
import { makeAttentionContext } from '../fixtures/test-helpers.js';
function makeStrategy(name, priority, transform) {
    return {
        name,
        priority,
        enhance: async (input) => transform(input),
    };
}
describe('AttentionEnhancer', () => {
    let enhancer;
    beforeEach(() => {
        enhancer = new AttentionEnhancer();
    });
    it('should return unmodified output with no strategies', async () => {
        const result = await enhancer.enhance('hello', makeAttentionContext());
        expect(result.prompt).toBe('hello');
        expect(result.systemPromptAppend).toBe('');
        expect(result.conversationHistory).toBeUndefined();
    });
    it('should execute strategies in priority order', async () => {
        const order = [];
        enhancer.register(makeStrategy('second', 20, (input) => {
            order.push('second');
            return { ...input, prompt: input.prompt + ' second' };
        }));
        enhancer.register(makeStrategy('first', 10, (input) => {
            order.push('first');
            return { ...input, prompt: input.prompt + ' first' };
        }));
        const result = await enhancer.enhance('start', makeAttentionContext());
        expect(order).toEqual(['first', 'second']);
        expect(result.prompt).toBe('start first second');
    });
    it('should allow strategies to modify systemPromptAppend', async () => {
        enhancer.register(makeStrategy('sys', 10, (input) => ({
            ...input,
            systemPromptAppend: 'injected system prompt',
        })));
        const result = await enhancer.enhance('hello', makeAttentionContext());
        expect(result.systemPromptAppend).toBe('injected system prompt');
    });
    it('should allow strategies to set conversationHistory', async () => {
        enhancer.register(makeStrategy('history', 10, (input) => ({
            ...input,
            conversationHistory: [
                { role: 'user', content: 'past question' },
                { role: 'assistant', content: 'past answer' },
            ],
        })));
        const result = await enhancer.enhance('hello', makeAttentionContext());
        expect(result.conversationHistory).toHaveLength(2);
    });
    it('should unregister strategies by name', async () => {
        enhancer.register(makeStrategy('keep', 10, (input) => ({
            ...input, prompt: input.prompt + ' kept',
        })));
        enhancer.register(makeStrategy('remove', 20, (input) => ({
            ...input, prompt: input.prompt + ' removed',
        })));
        enhancer.unregister('remove');
        const result = await enhancer.enhance('start', makeAttentionContext());
        expect(result.prompt).toBe('start kept');
    });
    it('should list registered strategies', () => {
        enhancer.register(makeStrategy('a', 20, (i) => i));
        enhancer.register(makeStrategy('b', 10, (i) => i));
        const strategies = enhancer.getStrategies();
        expect(strategies).toHaveLength(2);
        expect(strategies[0].name).toBe('b'); // lower priority first
        expect(strategies[1].name).toBe('a');
    });
});
//# sourceMappingURL=enhancer.test.js.map