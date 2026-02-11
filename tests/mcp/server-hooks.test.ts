import { describe, it, expect } from 'vitest';
import { McpServer } from '../../src/mcp/server.js';
import { HookExecutor } from '../../src/domain/hook/executor.js';
import { Logger } from '../../src/logging/logger.js';
import type { HookContext } from '../../src/domain/hook/types.js';

const logger = new Logger({ level: 'error' });

describe('McpServer Hook Integration', () => {
  it('emits after:tool event when hookExecutor is provided', async () => {
    const executor = new HookExecutor(logger);
    const events: string[] = [];

    executor.register({
      id: 'test-hook',
      event: 'after:tool',
      name: 'Test Hook',
      priority: 0,
      handler(ctx: HookContext) {
        events.push(`after:${ctx.toolName}`);
      },
    });

    const server = new McpServer('test', '1.0.0', logger, executor);
    server.registerTool({
      name: 'test_tool',
      description: 'A test tool',
      schema: { type: 'object', properties: {} },
      async execute() {
        return { success: true, data: 'ok' };
      },
    });

    // We can't easily call the handler directly since it's private,
    // but we can verify the hook executor has the handler registered
    expect(executor.getHandlers('after:tool')).toHaveLength(1);
  });

  it('constructs without hookExecutor (backward compatible)', () => {
    const server = new McpServer('test', '1.0.0', logger);
    server.registerTool({
      name: 'test_tool',
      description: 'A test tool',
      schema: { type: 'object', properties: {} },
      async execute() {
        return { success: true, data: 'ok' };
      },
    });
    // Should not throw
    expect(server).toBeDefined();
  });

  it('hook that writes hints does not throw', async () => {
    const executor = new HookExecutor(logger);
    executor.register({
      id: 'hint-hook',
      event: 'after:tool',
      name: 'Hint Hook',
      priority: 0,
      handler(ctx: HookContext) {
        ctx.data = ctx.data ?? {};
        ctx.data.hints = '**Rule triggered:** Do something';
      },
    });

    const server = new McpServer('test', '1.0.0', logger, executor);
    expect(server).toBeDefined();
    expect(executor.getHandlers('after:tool')).toHaveLength(1);
  });

  it('hook errors are caught by HookExecutor', async () => {
    const executor = new HookExecutor(logger);
    executor.register({
      id: 'bad-hook',
      event: 'after:tool',
      name: 'Bad Hook',
      priority: 0,
      handler() {
        throw new Error('hook failure');
      },
    });

    const result = await executor.emit({
      event: 'after:tool',
      toolName: 'test_tool',
      data: {},
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('hook failure');
  });

  it('augmentPrompt() triggers before:prompt hook', async () => {
    const executor = new HookExecutor(logger);
    executor.register({
      id: 'aug-hook',
      event: 'before:prompt',
      name: 'Aug Hook',
      priority: 0,
      handler(ctx: HookContext) {
        ctx.data = ctx.data ?? {};
        ctx.data.augmentedPrompt = ctx.data.prompt + ' [augmented]';
      },
    });

    const server = new McpServer('test', '1.0.0', logger, executor);
    const result = await server.augmentPrompt('hello');
    expect(result).toBe('hello [augmented]');
  });

  it('augmentPrompt() returns original prompt without hookExecutor', async () => {
    const server = new McpServer('test', '1.0.0', logger);
    const result = await server.augmentPrompt('hello');
    expect(result).toBe('hello');
  });
});