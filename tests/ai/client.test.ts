import { describe, it, expect, vi } from 'vitest';
import { AiClient } from '../../src/ai/client.js';
import type { AiClientConfig } from '../../src/ai/types.js';
import { TEST_BASE } from '../fixtures/test-helpers.js';
import * as path from 'node:path';

// Mock the SDK module
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(({ prompt, options }: any) => {
    // Return an async generator that yields a result message
    return (async function* () {
      yield {
        type: 'result',
        subtype: 'success',
        result: `Response to: ${prompt}`,
        session_id: 'mock-session-001',
        total_cost_usd: 0.05,
        duration_ms: 1500,
        num_turns: 2,
        structured_output: undefined,
      };
    })();
  }),
}));

describe('AiClient', () => {
  const config: AiClientConfig = {
    defaultModel: 'sonnet',
    defaultMaxTurns: 10,
    defaultMaxBudgetUsd: 1.0,
    projectRoot: path.join(TEST_BASE, 'project'),
  };

  it('should call SDK query and return mapped result', async () => {
    const client = new AiClient(config);
    const result = await client.call('Hello AI', {});

    expect(result.status).toBe('success');
    expect(result.text).toContain('Hello AI');
    expect(result.sessionId).toBe('mock-session-001');
    expect(result.costUsd).toBe(0.05);
    expect(result.durationMs).toBe(1500);
    expect(result.numTurns).toBe(2);
  });

  it('should pass options to SDK', async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    const client = new AiClient(config);

    await client.call('test', {
      model: 'opus',
      maxTurns: 20,
      systemPromptAppend: 'Be helpful',
      cwd: '/custom/dir',
    });

    expect(query).toHaveBeenCalled();
    const calls = (query as any).mock.calls;
    const callArgs = calls[calls.length - 1][0];
    expect(callArgs.prompt).toBe('test');
    expect(callArgs.options.model).toBe('opus');
    expect(callArgs.options.maxTurns).toBe(20);
    expect(callArgs.options.cwd).toBe('/custom/dir');
    expect(callArgs.options.systemPrompt.append).toBe('Be helpful');
  });

  it('should use default config values when options not provided', async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    const client = new AiClient(config);

    await client.call('test', {});

    const callArgs = (query as any).mock.calls.at(-1)[0];
    expect(callArgs.options.model).toBe('sonnet');
    expect(callArgs.options.maxTurns).toBe(10);
    expect(callArgs.options.maxBudgetUsd).toBe(1.0);
  });

  it('should handle error results', async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    (query as any).mockImplementationOnce(() => (async function* () {
      yield {
        type: 'result',
        subtype: 'error_max_turns',
        session_id: 'mock-session-002',
        total_cost_usd: 0.10,
        duration_ms: 5000,
        num_turns: 10,
        errors: ['Max turns reached'],
      };
    })());

    const client = new AiClient(config);
    const result = await client.call('test', {});

    expect(result.status).toBe('max_turns');
    expect(result.error).toBe('Max turns reached');
    expect(result.text).toBe('');
  });

  it('should handle max budget error', async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    (query as any).mockImplementationOnce(() => (async function* () {
      yield {
        type: 'result',
        subtype: 'error_max_budget_usd',
        session_id: 'mock-session-003',
        total_cost_usd: 1.0,
        duration_ms: 3000,
        num_turns: 5,
        errors: ['Budget exceeded'],
      };
    })());

    const client = new AiClient(config);
    const result = await client.call('test', {});

    expect(result.status).toBe('max_budget');
  });

  it('should handle no result message', async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    (query as any).mockImplementationOnce(() => (async function* () {
      yield { type: 'system', subtype: 'init' };
    })());

    const client = new AiClient(config);
    const result = await client.call('test', {});

    expect(result.status).toBe('error');
    expect(result.error).toContain('No result message');
  });

  it('should set bypassPermissions by default', async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    const client = new AiClient(config);

    await client.call('test', {});

    const callArgs = (query as any).mock.calls.at(-1)[0];
    expect(callArgs.options.permissionMode).toBe('bypassPermissions');
    expect(callArgs.options.allowDangerouslySkipPermissions).toBe(true);
  });
});
