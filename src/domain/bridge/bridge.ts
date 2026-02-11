import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Logger } from '../../logging/logger.js';
import type { BridgeServerConfig, BridgedTool } from './types.js';

export class McpBridge {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: BridgedTool[] = [];

  constructor(
    private config: BridgeServerConfig,
    private logger: Logger,
  ) {}

  async connect(): Promise<void> {
    try {
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: this.config.env,
      });

      this.client = new Client(
        { name: `bridge:${this.config.name}`, version: '1.0.0' },
        { capabilities: {} },
      );

      await this.client.connect(this.transport);

      const result = await this.client.listTools();
      this.tools = (result.tools ?? []).map((t) => ({
        originServer: this.config.name,
        name: t.name,
        description: t.description ?? '',
        inputSchema: (t.inputSchema as Record<string, unknown>) ?? {},
      }));

      this.logger.info('Bridge connected', {
        server: this.config.name,
        tools: this.tools.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('Bridge connect failed', {
        server: this.config.name,
        error: msg,
      });
      this.tools = [];
    }
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.client) {
      this.logger.error('Bridge not connected', { server: this.config.name });
      return { error: 'Bridge not connected' };
    }

    try {
      const result = await this.client.callTool({ name, arguments: args });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('Bridge callTool failed', {
        server: this.config.name,
        tool: name,
        error: msg,
      });
      return { error: msg };
    }
  }

  getTools(): BridgedTool[] {
    return this.tools;
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
      }
      this.logger.info('Bridge disconnected', { server: this.config.name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('Bridge disconnect failed', {
        server: this.config.name,
        error: msg,
      });
    } finally {
      this.client = null;
      this.transport = null;
      this.tools = [];
    }
  }
}
