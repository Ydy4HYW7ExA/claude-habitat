import { describe, it, expect } from 'vitest';
import { ContextBudgetStrategy } from '../../../src/attention/strategies/context-budget.js';
import { makeAttentionInput } from '../../fixtures/test-helpers.js';
import { CONTEXT_TRUNCATION_NOTICE } from '../../../src/constants.js';

describe('ContextBudgetStrategy', () => {
  it('should have correct name and priority', () => {
    const strategy = new ContextBudgetStrategy();
    expect(strategy.name).toBe('context-budget');
    expect(strategy.priority).toBe(50);
  });

  it('should pass through when under budget', async () => {
    const strategy = new ContextBudgetStrategy(100000);
    const input = makeAttentionInput('short prompt');
    const result = await strategy.enhance(input);
    expect(result.prompt).toBe('short prompt');
  });

  it('should truncate prompt when over budget', async () => {
    const strategy = new ContextBudgetStrategy(100); // very small budget
    const longPrompt = 'x'.repeat(10000);
    const result = await strategy.enhance(makeAttentionInput(longPrompt));

    expect(result.prompt.length).toBeLessThan(longPrompt.length);
    expect(result.prompt).toContain(CONTEXT_TRUNCATION_NOTICE);
  });

  it('should handle extreme case where system prompt is too large', async () => {
    const strategy = new ContextBudgetStrategy(100);
    const input = makeAttentionInput('prompt');
    input.systemPromptAppend = 'y'.repeat(10000);
    const result = await strategy.enhance(input);

    // Should still produce output without crashing
    expect(result.prompt).toBeDefined();
    expect(result.systemPromptAppend).toBeDefined();
  });

  it('should trim history in extreme cases', async () => {
    const strategy = new ContextBudgetStrategy(50);
    const history = Array.from({ length: 20 }, () => ({
      role: 'user' as const,
      content: 'x'.repeat(500),
    }));

    const input = makeAttentionInput('prompt');
    input.systemPromptAppend = 'system';
    input.conversationHistory = history;
    const result = await strategy.enhance(input);
    expect(result.conversationHistory!.length).toBeLessThan(history.length);
  });
});
