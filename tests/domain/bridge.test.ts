import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from '../../src/logging/logger.js';
import type { BridgeServerConfig } from '../../src/domain/bridge/types.js';

const mockConnect = vi.fn();
const mockListTools = vi.fn();
const mockCallTool = vi.fn();
const mockClose = vi.fn();

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn(() => ({
    connect: mockConnect,
    listTools: mockListTools,
    callTool: mockCallTool,
    close: mockClose,
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn(),
}));

// Import after mocks are set up
const { McpBridge } = await import('../../src/domain/bridge/bridge.js');

const logger = new Logger({ level: 'error' });

const testConfig: BridgeServerConfig = {
  name: 'playwright',
  command: 'npx',
  args: ['@anthropic/pw'],
};

describe('McpBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('connect() discovers tools on success', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockListTools.mockResolvedValue({
      tools: [
        { name: 'browser_click', description: 'Click element', inputSchema: { type: 'object' } },
        { name: 'browser_type', description: 'Type text', inputSchema: { type: 'object' } },
      ],
    });

    const bridge = new McpBridge(testConfig, logger);
    await bridge.connect();

    const tools = bridge.getTools();
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('browser_click');
    expect(tools[0].originServer).toBe('playwright');
    expect(tools[1].name).toBe('browser_type');
  });

  it('callTool() proxies to client.callTool()', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockListTools.mockResolvedValue({ tools: [] });
    mockCallTool.mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
    });

    const bridge = new McpBridge(testConfig, logger);
    await bridge.connect();

    const result = await bridge.callTool('browser_click', { selector: '#btn' });
    expect(mockCallTool).toHaveBeenCalledWith({
      name: 'browser_click',
      arguments: { selector: '#btn' },
    });
    expect(result).toEqual({ content: [{ type: 'text', text: 'ok' }] });
  });

  it('connect() failure does not throw, getTools() returns empty', async () => {
    mockConnect.mockRejectedValue(new Error('spawn failed'));

    const bridge = new McpBridge(testConfig, logger);
    await bridge.connect(); // should not throw

    expect(bridge.getTools()).toEqual([]);
  });

  it('callTool() returns error when not connected', async () => {
    const bridge = new McpBridge(testConfig, logger);
    const result = await bridge.callTool('anything', {});
    expect(result).toEqual({ error: 'Bridge not connected' });
  });

  it('disconnect() cleans up resources', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockListTools.mockResolvedValue({
      tools: [{ name: 'tool1', description: 'desc', inputSchema: {} }],
    });
    mockClose.mockResolvedValue(undefined);

    const bridge = new McpBridge(testConfig, logger);
    await bridge.connect();
    expect(bridge.getTools()).toHaveLength(1);

    await bridge.disconnect();
    expect(mockClose).toHaveBeenCalled();
    expect(bridge.getTools()).toEqual([]);
  });
});
