import type { Container } from '../../di/container.js';
import { Tokens } from '../../di/tokens.js';
import { defineTool, type ToolMetadata } from '../define-tool.js';
import type { BridgeServerConfig } from '../../domain/bridge/types.js';

export function registerBridgeManagementTools(container: Container): ToolMetadata[] {
  return [
    defineTool({
      name: 'habitat_bridge_list',
      description: 'List all configured bridge MCP servers and their status.',
      schema: {
        type: 'object',
        properties: {},
      },
      async handler() {
        const configLoader = container.resolve(Tokens.ConfigLoader);
        const habitatDir = container.resolve(Tokens.HabitatDir);
        const config = await configLoader.load(habitatDir);
        const servers = config.bridge?.servers ?? [];
        return {
          servers: servers.map((s) => ({
            name: s.name,
            command: s.command,
            args: s.args,
            env: s.env ?? {},
            enabled: s.enabled ?? true,
          })),
          count: servers.length,
        };
      },
    }),

    defineTool({
      name: 'habitat_bridge_add',
      description: 'Add a new bridge MCP server configuration. Requires MCP server restart to take effect.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Unique server name' },
          command: { type: 'string', description: 'Command to launch the server' },
          args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
          env: { type: 'object', description: 'Optional environment variables' },
          enabled: { type: 'boolean', description: 'Whether the server is enabled (default: true)' },
        },
        required: ['name', 'command', 'args'],
      },
      async handler(input: {
        name: string;
        command: string;
        args: string[];
        env?: Record<string, string>;
        enabled?: boolean;
      }) {
        const configLoader = container.resolve(Tokens.ConfigLoader);
        const habitatDir = container.resolve(Tokens.HabitatDir);
        const config = await configLoader.load(habitatDir);

        if (!config.bridge) config.bridge = {};
        if (!config.bridge.servers) config.bridge.servers = [];

        const existing = config.bridge.servers.find((s) => s.name === input.name);
        if (existing) {
          return { error: `Bridge server "${input.name}" already exists. Use habitat_bridge_update to modify it.` };
        }

        const server: BridgeServerConfig = {
          name: input.name,
          command: input.command,
          args: input.args,
          env: input.env,
          enabled: input.enabled ?? true,
        };
        config.bridge.servers.push(server);
        await configLoader.save(habitatDir, config);

        return { added: input.name, restartRequired: true };
      },
    }),

    defineTool({
      name: 'habitat_bridge_update',
      description: 'Update an existing bridge MCP server configuration. Requires MCP server restart to take effect.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Server name to update' },
          command: { type: 'string', description: 'New command' },
          args: { type: 'array', items: { type: 'string' }, description: 'New arguments' },
          env: { type: 'object', description: 'New environment variables' },
          enabled: { type: 'boolean', description: 'Enable or disable' },
        },
        required: ['name'],
      },
      async handler(input: {
        name: string;
        command?: string;
        args?: string[];
        env?: Record<string, string>;
        enabled?: boolean;
      }) {
        const configLoader = container.resolve(Tokens.ConfigLoader);
        const habitatDir = container.resolve(Tokens.HabitatDir);
        const config = await configLoader.load(habitatDir);

        const servers = config.bridge?.servers ?? [];
        const server = servers.find((s) => s.name === input.name);
        if (!server) {
          return { error: `Bridge server "${input.name}" not found.` };
        }

        if (input.command !== undefined) server.command = input.command;
        if (input.args !== undefined) server.args = input.args;
        if (input.env !== undefined) server.env = input.env;
        if (input.enabled !== undefined) server.enabled = input.enabled;

        await configLoader.save(habitatDir, config);
        return { updated: input.name, restartRequired: true };
      },
    }),

    defineTool({
      name: 'habitat_bridge_remove',
      description: 'Remove a bridge MCP server configuration. Requires MCP server restart to take effect.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Server name to remove' },
        },
        required: ['name'],
      },
      async handler(input: { name: string }) {
        const configLoader = container.resolve(Tokens.ConfigLoader);
        const habitatDir = container.resolve(Tokens.HabitatDir);
        const config = await configLoader.load(habitatDir);

        if (!config.bridge?.servers) {
          return { error: `Bridge server "${input.name}" not found.` };
        }

        const idx = config.bridge.servers.findIndex((s) => s.name === input.name);
        if (idx === -1) {
          return { error: `Bridge server "${input.name}" not found.` };
        }

        config.bridge.servers.splice(idx, 1);
        await configLoader.save(habitatDir, config);
        return { removed: input.name, restartRequired: true };
      },
    }),
  ];
}
