import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ToolMetadata } from './define-tool.js';
import type { Logger } from '../logging/logger.js';
import type { Envelope } from '../infra/types.js';
import type { HookExecutor } from '../domain/hook/executor.js';
import type { HookContext } from '../domain/hook/types.js';

export type ToolMiddleware = (
  toolName: string,
  input: unknown,
) => Envelope | null;

export class McpServer {
  private server: Server;
  private tools = new Map<string, ToolMetadata>();
  private middlewares: ToolMiddleware[] = [];

  constructor(
    private name: string,
    private version: string,
    private logger: Logger,
    private hookExecutor?: HookExecutor,
  ) {
    this.server = new Server(
      { name: this.name, version: this.version },
      { capabilities: { tools: {} } },
    );
    this.setupHandlers();
  }

  registerTool(tool: ToolMetadata): void {
    this.tools.set(tool.name, tool);
  }

  registerTools(tools: ToolMetadata[]): void {
    for (const t of tools) this.registerTool(t);
  }

  use(mw: ToolMiddleware): void {
    this.middlewares.push(mw);
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async () => ({
        tools: [...this.tools.values()].map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.schema,
        })),
      }),
    );

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        const toolName = request.params.name;
        const tool = this.tools.get(toolName);
        if (!tool) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  success: false,
                  error: `Unknown tool: ${toolName}`,
                }),
              },
            ],
          };
        }

        this.logger.debug('Tool called', { tool: toolName });
        const input = request.params.arguments ?? {};

        for (const mw of this.middlewares) {
          const blocked = mw(toolName, input);
          if (blocked) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(blocked, null, 2),
                },
              ],
            };
          }
        }

        const result = await tool.execute(input);

        // Emit after:tool hook
        if (this.hookExecutor) {
          const hookCtx: HookContext = {
            event: 'after:tool',
            toolName,
            data: { input, result },
          };
          await this.hookExecutor.emit(hookCtx);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      },
    );
  }

  async augmentPrompt(prompt: string): Promise<string> {
    if (!this.hookExecutor) return prompt;
    const ctx: HookContext = {
      event: 'before:prompt',
      data: { prompt },
    };
    await this.hookExecutor.emit(ctx);
    return (ctx.data?.augmentedPrompt as string) ?? prompt;
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('MCP server started', {
      name: this.name,
      tools: this.tools.size,
    });
  }

  async shutdown(): Promise<void> {
    try {
      await this.server.close();
      this.logger.info('MCP server shut down');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('MCP server shutdown error', { error: msg });
    }
  }
}
