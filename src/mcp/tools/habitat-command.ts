import type { Container } from '../../di/container.js';
import { Tokens } from '../../di/tokens.js';
import { defineTool, type ToolMetadata } from '../define-tool.js';

export function registerHabitatCommandTools(container: Container): ToolMetadata[] {
  return [
    defineTool({
      name: 'habitat_command_create',
      description: 'Create a habitat command file.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Command name (must start with habitat-, kebab-case)' },
          content: { type: 'string', description: 'Markdown content of the command' },
          scope: { type: 'string', enum: ['global', 'project'], description: 'Scope: global or project' },
        },
        required: ['name', 'content', 'scope'],
      },
      async handler(input: { name: string; content: string; scope: 'global' | 'project' }) {
        const svc = container.resolve(Tokens.HabitatFileService);
        return svc.create({ ...input, kind: 'command' });
      },
    }),

    defineTool({
      name: 'habitat_command_read',
      description: 'Read a habitat command file.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Command name' },
          scope: { type: 'string', enum: ['global', 'project'] },
        },
        required: ['name', 'scope'],
      },
      async handler(input: { name: string; scope: 'global' | 'project' }) {
        const svc = container.resolve(Tokens.HabitatFileService);
        return svc.read(input.name, 'command', input.scope);
      },
    }),

    defineTool({
      name: 'habitat_command_update',
      description: 'Update a habitat command file.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Command name' },
          content: { type: 'string', description: 'New markdown content' },
          scope: { type: 'string', enum: ['global', 'project'] },
        },
        required: ['name', 'content', 'scope'],
      },
      async handler(input: { name: string; content: string; scope: 'global' | 'project' }) {
        const svc = container.resolve(Tokens.HabitatFileService);
        return svc.update({ ...input, kind: 'command' });
      },
    }),

    defineTool({
      name: 'habitat_command_delete',
      description: 'Delete a habitat command and its symlink.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Command name' },
          scope: { type: 'string', enum: ['global', 'project'] },
        },
        required: ['name', 'scope'],
      },
      async handler(input: { name: string; scope: 'global' | 'project' }) {
        const svc = container.resolve(Tokens.HabitatFileService);
        await svc.delete(input.name, 'command', input.scope);
        return { deleted: input.name };
      },
    }),

    defineTool({
      name: 'habitat_command_list',
      description: 'List all habitat commands.',
      schema: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['global', 'project'] },
        },
        required: ['scope'],
      },
      async handler(input: { scope: 'global' | 'project' }) {
        const svc = container.resolve(Tokens.HabitatFileService);
        return svc.list('command', input.scope);
      },
    }),
  ];
}
