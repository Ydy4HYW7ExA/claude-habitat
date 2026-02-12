import { describe, it, expect, afterEach, vi } from 'vitest';
import * as net from 'node:net';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import { SocketServer } from '../../src/mcp/socket-server.js';

const TEST_BASE = path.join(os.tmpdir(), 'habitat-test-mcp');

describe('SocketServer', () => {
  let server: SocketServer | null = null;
  let tmpDir: string;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
    try {
      await fs.rm(tmpDir, { recursive: true });
    } catch { /* ignore */ }
  });

  async function setup(handlers: Record<string, (args: unknown) => Promise<unknown>> = {}) {
    tmpDir = path.join(TEST_BASE, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    const socketPath = path.join(tmpDir, 'test.sock');

    server = new SocketServer({
      socketPath,
      handlers,
      logger: vi.fn(),
    });
    await server.start();
    return socketPath;
  }

  function connectClient(socketPath: string): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(socketPath, () => resolve(client));
      client.on('error', reject);
    });
  }

  function sendAndReceive(client: net.Socket, msg: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      let buffer = '';
      const onData = (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop()!;
        for (const line of lines) {
          if (!line.trim()) continue;
          client.removeListener('data', onData);
          resolve(JSON.parse(line));
          return;
        }
      };
      client.on('data', onData);
      client.write(JSON.stringify(msg) + '\n');
    });
  }

  it('starts and stops without error', async () => {
    await setup();
    await server!.stop();
    server = null;
  });

  it('handles a simple method call', async () => {
    const socketPath = await setup({
      greet: async (args) => {
        const { name } = args as { name: string };
        return `Hello, ${name}!`;
      },
    });

    const client = await connectClient(socketPath);
    const response = await sendAndReceive(client, {
      id: 'req-1',
      method: 'greet',
      args: { name: 'World' },
    });

    expect(response.id).toBe('req-1');
    expect(response.result).toBe('Hello, World!');
    client.destroy();
  });

  it('returns error for unknown method', async () => {
    const socketPath = await setup({});

    const client = await connectClient(socketPath);
    const response = await sendAndReceive(client, {
      id: 'req-2',
      method: 'nonexistent',
      args: {},
    });

    expect(response.id).toBe('req-2');
    expect(response.error).toContain('Unknown method');
    client.destroy();
  });

  it('returns error when handler throws', async () => {
    const socketPath = await setup({
      fail: async () => { throw new Error('boom'); },
    });

    const client = await connectClient(socketPath);
    const response = await sendAndReceive(client, {
      id: 'req-3',
      method: 'fail',
      args: {},
    });

    expect(response.id).toBe('req-3');
    expect(response.error).toBe('boom');
    client.destroy();
  });

  it('handles multiple sequential requests', async () => {
    let counter = 0;
    const socketPath = await setup({
      increment: async () => ++counter,
    });

    const client = await connectClient(socketPath);

    const r1 = await sendAndReceive(client, { id: '1', method: 'increment', args: {} });
    const r2 = await sendAndReceive(client, { id: '2', method: 'increment', args: {} });

    expect(r1.result).toBe(1);
    expect(r2.result).toBe(2);
    client.destroy();
  });

  it('cleans up socket file on stop', async () => {
    const socketPath = await setup();
    // Socket file should exist
    await fs.access(socketPath);

    await server!.stop();
    server = null;

    // Socket file should be cleaned up
    await expect(fs.access(socketPath)).rejects.toThrow();
  });
});
