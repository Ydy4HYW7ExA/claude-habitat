import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from '../../src/ai/session-manager.js';
import { SESSION_STATUS } from '../../src/constants.js';
import { makeProcess, makeProgram } from '../fixtures/test-helpers.js';

// Mock the SDK query() to return an async generator
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

function createMockQuery() {
  let resolveNext: ((value: unknown) => void) | null = null;
  let done = false;
  const messages: unknown[] = [];

  const generator = {
    [Symbol.asyncIterator]() { return this; },
    async next() {
      if (messages.length > 0) {
        return { value: messages.shift(), done: false };
      }
      if (done) {
        return { value: undefined, done: true };
      }
      return new Promise<IteratorResult<unknown>>((resolve) => {
        resolveNext = (msg) => {
          resolve({ value: msg, done: false });
        };
      });
    },
  };

  return {
    generator,
    pushMessage(msg: unknown) {
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r(msg);
      } else {
        messages.push(msg);
      }
    },
    finish() {
      done = true;
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r({ value: undefined, done: true } as IteratorResult<unknown>);
      }
    },
  };
}

describe('SessionManager', () => {
  let manager: SessionManager;
  let mockQuery: ReturnType<typeof createMockQuery>;

  beforeEach(async () => {
    mockQuery = createMockQuery();
    const sdk = await import('@anthropic-ai/claude-agent-sdk');
    (sdk.query as ReturnType<typeof vi.fn>).mockReturnValue(mockQuery.generator);

    manager = new SessionManager({
      projectRoot: '/tmp/test',
      defaultModel: 'sonnet',
      defaultMaxTurns: 30,
      defaultMaxBudgetUsd: 1.0,
      logger: vi.fn(),
    });
  });

  it('startSession creates a session handle', async () => {
    const position = makeProcess({ id: 'test-pos' });
    const template = makeProgram();

    const handle = await manager.startSession(position, template, {});
    expect(handle.positionId).toBe('test-pos');
    expect(handle.status).toBe(SESSION_STATUS.READY);
    expect(handle.inputChannel).toBeDefined();
  });

  it('startSession returns existing session if already started', async () => {
    const position = makeProcess({ id: 'test-pos' });
    const template = makeProgram();

    const h1 = await manager.startSession(position, template, {});
    const h2 = await manager.startSession(position, template, {});
    expect(h1).toBe(h2);
  });

  it('getSession returns the handle', async () => {
    const position = makeProcess({ id: 'test-pos' });
    const template = makeProgram();

    await manager.startSession(position, template, {});
    const handle = manager.getSession('test-pos');
    expect(handle).toBeDefined();
    expect(handle!.positionId).toBe('test-pos');
  });

  it('getSession returns undefined for unknown position', () => {
    expect(manager.getSession('unknown')).toBeUndefined();
  });

  it('sendAndWait pushes message and resolves on result', async () => {
    const position = makeProcess({ id: 'test-pos' });
    const template = makeProgram();

    await manager.startSession(position, template, {});

    // Start sendAndWait — it will push to channel and wait for result
    const resultPromise = manager.sendAndWait('test-pos', 'do something');

    // Simulate SDK returning a result message
    // Give the event loop a tick for the push to be consumed
    await new Promise(r => setTimeout(r, 10));
    mockQuery.pushMessage({
      type: 'result',
      subtype: 'success',
      result: 'done!',
      session_id: 'sess-123',
      total_cost_usd: 0.05,
      duration_ms: 1000,
      num_turns: 3,
    });

    const result = await resultPromise;
    expect(result.text).toBe('done!');
    expect(result.sessionId).toBe('sess-123');
    expect(result.status).toBe('success');
    expect(result.costUsd).toBe(0.05);
  });

  it('sendAndWait throws if no session exists', async () => {
    await expect(manager.sendAndWait('nope', 'hi')).rejects.toThrow('No session for position: nope');
  });

  it('sendAndWait throws if session is busy', async () => {
    const position = makeProcess({ id: 'test-pos' });
    const template = makeProgram();

    const handle = await manager.startSession(position, template, {});
    handle.status = SESSION_STATUS.BUSY;

    await expect(manager.sendAndWait('test-pos', 'hi')).rejects.toThrow('busy');
  });

  it('sendAndWait throws if session is closed', async () => {
    const position = makeProcess({ id: 'test-pos' });
    const template = makeProgram();

    const handle = await manager.startSession(position, template, {});
    handle.status = SESSION_STATUS.CLOSED;

    await expect(manager.sendAndWait('test-pos', 'hi')).rejects.toThrow('closed');
  });

  it('stopSession closes the channel and removes session', async () => {
    const position = makeProcess({ id: 'test-pos' });
    const template = makeProgram();

    await manager.startSession(position, template, {});
    await manager.stopSession('test-pos');

    expect(manager.getSession('test-pos')).toBeUndefined();
  });

  it('stopAll stops all sessions', async () => {
    const p1 = makeProcess({ id: 'pos-1' });
    const p2 = makeProcess({ id: 'pos-2' });
    const template = makeProgram();

    await manager.startSession(p1, template, {});
    await manager.startSession(p2, template, {});

    await manager.stopAll();

    expect(manager.getSession('pos-1')).toBeUndefined();
    expect(manager.getSession('pos-2')).toBeUndefined();
  });

  it('stopSession should reject pending sendAndWait promise', async () => {
    const position = makeProcess({ id: 'test-pos' });
    const template = makeProgram();

    await manager.startSession(position, template, {});

    // Start sendAndWait — it will hang waiting for a result
    const resultPromise = manager.sendAndWait('test-pos', 'do something');

    // Give the event loop a tick
    await new Promise(r => setTimeout(r, 10));

    // Stop the session — should reject the pending promise
    await manager.stopSession('test-pos');

    await expect(resultPromise).rejects.toThrow('Session stopped');
  });

  it('consumptionLoop crash should reject pending sendAndWait', async () => {
    // Create a query mock that throws during iteration
    const sdk = await import('@anthropic-ai/claude-agent-sdk');
    let callCount = 0;
    const crashingGenerator = {
      [Symbol.asyncIterator]() { return this; },
      async next(): Promise<IteratorResult<unknown>> {
        callCount++;
        if (callCount === 1) {
          // First call: return a non-result message so the loop continues
          return new Promise<IteratorResult<unknown>>((resolve) => {
            setTimeout(() => {
              resolve({ value: { type: 'progress', message: 'working...' }, done: false });
            }, 5);
          });
        }
        throw new Error('SDK crash');
      },
    };
    (sdk.query as ReturnType<typeof vi.fn>).mockReturnValue(crashingGenerator);

    const crashManager = new SessionManager({
      projectRoot: '/tmp/test',
      defaultModel: 'sonnet',
      defaultMaxTurns: 30,
      defaultMaxBudgetUsd: 1.0,
      logger: vi.fn(),
    });

    const position = makeProcess({ id: 'crash-pos' });
    const template = makeProgram();

    await crashManager.startSession(position, template, {});

    // sendAndWait sets up the resolver/rejecter and pushes a message
    const resultPromise = crashManager.sendAndWait('crash-pos', 'hello');

    // Give the consumption loop time to crash on the second next() call
    await expect(resultPromise).rejects.toThrow('SDK crash');
  });
});
