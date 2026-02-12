import type { PositionManager } from '../position/manager.js';
export interface AdminToolDeps {
    positionManager: PositionManager;
    projectRoot: string;
}
/**
 * Creates an MCP server with admin tools (org-architect only).
 * Uses SDK's tool() and createSdkMcpServer() for proper registration.
 */
export declare function createAdminMcpServer(deps: AdminToolDeps): Promise<import("@anthropic-ai/claude-agent-sdk").McpSdkServerConfigWithInstance>;
//# sourceMappingURL=admin-tools.d.ts.map