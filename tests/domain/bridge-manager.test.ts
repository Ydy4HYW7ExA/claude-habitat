import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from '../../src/logging/logger.js';
import type { BridgeConfig } from '../../src/domain/bridge/types.js';

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

const { McpBridgeManager } = await import('../../src/domain/bridge/manager.js');

const logger = new Logger({ level: 'error' });

describe('McpBridgeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('startAll() starts all enabled bridges', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockListTools.mockResolvedValue({
      tools: [{ name: 'tool1', description: 'desc', inputSchema: {} }],
    });

    const config: BridgeConfig = {
      servers: [
        { name: 'server-a', command: 'npx', args: ['a'] },
        { name: 'server-b', command: 'npx', args: ['b'] },
      ],
    };

    const manager = new McpBridgeManager(config, logger);
    await manager.startAll();

    expect(manager.getAllTools()).toHaveLength(2);
  });

  it('startAll() skips enabled=false bridges', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockListTools.mockResolvedValue({
      tools: [{ name: 'tool1', description: 'desc', inputSchema: {} }],
    });

    const config: BridgeConfig = {
      servers: [
        { name: 'active', command: 'npx', args: ['a'] },
        { name: 'disabled', command: 'npx', args: ['b'], enabled: false },
      ],
    };

    const manager = new McpBridgeManager(config, logger);
    await manager.startAll();

    // Only one bridge started, so only one tool
    expect(manager.getAllTools()).toHaveLength(1);
    expect(manager.getAllTools()[0].originServer).toBe('active');
  });

  it('getAllTools() aggregates tools from all bridges', async () => {
    let callCount = 0;
    mockConnect.mockResolvedValue(undefined);
    mockListTools.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { tools: [{ name: 'click', description: 'Click', inputSchema: {} }] };
      }
      return { tools: [{ name: 'type', description: 'Type', inputSchema: {} }] };
    });

    const config: BridgeConfig = {
      servers: [
        { name: 'pw', command: 'npx', args: ['pw'] },
        { name: 'other', command: 'npx', args: ['other'] },
      ],
    };

    const manager = new McpBridgeManager(config, logger);
    await manager.startAll();

    const tools = manager.getAllTools();
    expect(tools).toHaveLength(2);
    expect(tools.map(t => t.name)).toContain('click');
    expect(tools.map(t => t.name)).toContain('type');
  });

  it('getAllTools() prefixes duplicate tool names with bridge_', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockListTools.mockResolvedValue({
      tools: [{ name: 'shared_tool', description: 'desc', inputSchema: {} }],
    });

    const config: BridgeConfig = {
      servers: [
        { name: 'first', command: 'npx', args: ['a'] },
        { name: 'second', command: 'npx', args: ['b'] },
      ],
    };

    const manager = new McpBridgeManager(config, logger);
    await manager.startAll();

    const tools = manager.getAllTools();
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('shared_tool');
    expect(tools[1].name).toBe('bridge_shared_tool');
  });

  it('callTool() routes to correct bridge', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockListTools.mockResolvedValue({ tools: [] });
    mockCallTool.mockResolvedValue({ content: [{ type: 'text', text: 'result' }] });

    const config: BridgeConfig = {
      servers: [{ name: 'pw', command: 'npx', args: ['pw'] }],
    };

    const manager = new McpBridgeManager(config, logger);
    await manager.startAll();

    const result = await manager.callTool('pw', 'click', { sel: '#x' });
    expect(mockCallTool).toHaveBeenCalledWith({ name: 'click', arguments: { sel: '#x' } });
    expect(result).toEqual({ content: [{ type: 'text', text: 'result' }] });
  });

  it('callTool() returns error for unknown bridge', async () => {
    const manager = new McpBridgeManager({}, logger);
    await manager.startAll();

    const result = await manager.callTool('nonexistent', 'tool', {});
    expect(result).toEqual({ error: 'Bridge not found: nonexistent' });
  });

  it('shutdownAll() closes all bridges', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockListTools.mockResolvedValue({ tools: [] });
    mockClose.mockResolvedValue(undefined);

    const config: BridgeConfig = {
      servers: [
        { name: 'a', command: 'npx', args: ['a'] },
        { name: 'b', command: 'npx', args: ['b'] },
      ],
    };

    const manager = new McpBridgeManager(config, logger);
    await manager.startAll();
    await manager.shutdownAll();

    expect(mockClose).toHaveBeenCalledTimes(2);
    expect(manager.getAllTools()).toEqual([]);
  });

  it('empty config startAll() does not error', async () => {
    const manager = new McpBridgeManager({}, logger);
    await manager.startAll(); // should not throw
    expect(manager.getAllTools()).toEqual([]);
  });
});
