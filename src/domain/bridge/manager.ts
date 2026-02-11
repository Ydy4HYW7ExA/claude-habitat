import type { Logger } from '../../logging/logger.js';
import type { BridgeConfig, BridgedTool } from './types.js';
import { McpBridge } from './bridge.js';

export class McpBridgeManager {
  private bridges = new Map<string, McpBridge>();

  constructor(
    private config: BridgeConfig,
    private logger: Logger,
  ) {}

  async startAll(): Promise<void> {
    const servers = this.config.servers ?? [];
    for (const serverConfig of servers) {
      if (serverConfig.enabled === false) continue;

      const bridge = new McpBridge(serverConfig, this.logger.child(serverConfig.name));
      await bridge.connect();
      this.bridges.set(serverConfig.name, bridge);
    }

    this.logger.info('Bridge manager started', { bridges: this.bridges.size });
  }

  getAllTools(): BridgedTool[] {
    const allTools: BridgedTool[] = [];
    const seenNames = new Set<string>();

    for (const bridge of this.bridges.values()) {
      for (const tool of bridge.getTools()) {
        const name = seenNames.has(tool.name)
          ? `bridge_${tool.name}`
          : tool.name;
        seenNames.add(tool.name);
        allTools.push({ ...tool, name });
      }
    }

    return allTools;
  }

  async callTool(
    originServer: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const bridge = this.bridges.get(originServer);
    if (!bridge) {
      this.logger.error('Bridge not found', { server: originServer });
      return { error: `Bridge not found: ${originServer}` };
    }
    return bridge.callTool(toolName, args);
  }

  async shutdownAll(): Promise<void> {
    for (const bridge of this.bridges.values()) {
      await bridge.disconnect();
    }
    this.bridges.clear();
    this.logger.info('All bridges shut down');
  }
}
