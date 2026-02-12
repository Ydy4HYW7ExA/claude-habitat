import type { MemoryStore } from '../memory/types.js';
import type { Position } from '../position/types.js';
import type { EventBus } from '../orchestration/event-bus.js';
export interface McpToolResult {
    content: {
        type: 'text';
        text: string;
    }[];
}
export interface PositionMcpDeps {
    memoryStore: MemoryStore;
    globalMemoryStore: MemoryStore;
    eventBus: EventBus;
    position: Position;
}
/**
 * Creates an MCP server with all position-level tools (memory + events).
 * Uses SDK's tool() and createSdkMcpServer() for proper registration.
 */
export declare function createPositionMcpServer(deps: PositionMcpDeps): Promise<import("@anthropic-ai/claude-agent-sdk").McpSdkServerConfigWithInstance>;
//# sourceMappingURL=mcp-tools.d.ts.map