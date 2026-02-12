/**
 * Socket server — parent process side of the MCP bridge.
 * Listens on a Unix socket, accepts JSON-RPC requests from bridge-server,
 * dispatches to registered handlers, and returns results.
 */
import * as net from 'node:net';
import * as fs from 'node:fs/promises';

export interface SocketServerConfig {
  socketPath: string;
  handlers: Record<string, (args: unknown) => Promise<unknown>>;
  logger: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
}

interface JsonRpcRequest {
  id: string;
  method: string;
  args: unknown;
}

interface JsonRpcResponse {
  id: string;
  result?: unknown;
  error?: string;
}

export class SocketServer {
  private server: net.Server | null = null;
  private connections = new Set<net.Socket>();

  constructor(private config: SocketServerConfig) {}

  async start(): Promise<void> {
    // Clean up stale socket file
    try {
      await fs.unlink(this.config.socketPath);
    } catch {
      // File doesn't exist, that's fine
    }

    return new Promise<void>((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.connections.add(socket);
        socket.on('close', () => this.connections.delete(socket));

        let buffer = '';
        socket.on('data', (data) => {
          buffer += data.toString();
          // Process complete JSON messages (newline-delimited)
          const lines = buffer.split('\n');
          buffer = lines.pop()!; // Keep incomplete line in buffer
          for (const line of lines) {
            if (!line.trim()) continue;
            this.handleMessage(socket, line).catch((err) => {
              this.config.logger('error', `Socket message handling error: ${err}`);
            });
          }
        });

        socket.on('error', (err) => {
          this.config.logger('error', `Socket connection error: ${err.message}`);
        });
      });

      this.server.on('error', reject);
      this.server.listen(this.config.socketPath, () => {
        this.config.logger('debug', `Socket server listening on ${this.config.socketPath}`);
        resolve();
      });
    });
  }

  private async handleMessage(socket: net.Socket, raw: string): Promise<void> {
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(raw) as JsonRpcRequest;
    } catch {
      this.config.logger('warn', `Invalid JSON from socket: ${raw.slice(0, 100)}`);
      return;
    }

    const handler = this.config.handlers[request.method];
    let response: JsonRpcResponse;

    if (!handler) {
      response = { id: request.id, error: `Unknown method: ${request.method}` };
    } else {
      try {
        const result = await handler(request.args);
        response = { id: request.id, result };
      } catch (err) {
        response = { id: request.id, error: err instanceof Error ? err.message : String(err) };
      }
    }

    const data = JSON.stringify(response) + '\n';
    socket.write(data);
  }

  async stop(): Promise<void> {
    for (const conn of this.connections) {
      conn.destroy();
    }
    this.connections.clear();

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    // Clean up socket file
    try {
      await fs.unlink(this.config.socketPath);
    } catch {
      // Already cleaned up
    }
  }
}
