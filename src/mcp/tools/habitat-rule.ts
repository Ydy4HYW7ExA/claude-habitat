import type { Container } from '../../di/container.js';
import { Tokens } from '../../di/tokens.js';
import { defineTool, type ToolMetadata } from '../define-tool.js';

export function registerHabitatRuleTools(container: Container): ToolMetadata[] {
  return [
    defineTool({
      name: 'habitat_rule_create',
      description: 'Create a habitat rule file. Automatically refreshes CLAUDE.md.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Rule name (must start with habitat-, kebab-case)' },
          content: { type: 'string', description: 'JSON content of the rule' },
          scope: { type: 'string', enum: ['global', 'project'], description: 'Scope: global or project' },
        },
        required: ['name', 'content', 'scope'],
      },
      async handler(input: { name: string; content: string; scope: 'global' | 'project' }) {
        const svc = container.resolve(Tokens.HabitatFileService);
        return svc.create({ ...input, kind: 'rule' });
      },
    }),

    defineTool({
      name: 'habitat_rule_read',
      description: 'Read a habitat rule file.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Rule name' },
          scope: { type: 'string', enum: ['global', 'project'] },
        },
        required: ['name', 'scope'],
      },
      async handler(input: { name: string; scope: 'global' | 'project' }) {
        const svc = container.resolve(Tokens.HabitatFileService);
        return svc.read(input.name, 'rule', input.scope);
      },
    }),

    defineTool({
      name: 'habitat_rule_update',
      description: 'Update a habitat rule file. Automatically refreshes CLAUDE.md.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Rule name' },
          content: { type: 'string', description: 'New JSON content' },
          scope: { type: 'string', enum: ['global', 'project'] },
        },
        required: ['name', 'content', 'scope'],
      },
      async handler(input: { name: string; content: string; scope: 'global' | 'project' }) {
        const svc = container.resolve(Tokens.HabitatFileService);
        return svc.update({ ...input, kind: 'rule' });
      },
    }),

    defineTool({
      name: 'habitat_rule_delete',
      description: 'Delete a habitat rule and refresh CLAUDE.md.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Rule name' },
          scope: { type: 'string', enum: ['global', 'project'] },
        },
        required: ['name', 'scope'],
      },
      async handler(input: { name: string; scope: 'global' | 'project' }) {
        const svc = container.resolve(Tokens.HabitatFileService);
        await svc.delete(input.name, 'rule', input.scope);
        return { deleted: input.name };
      },
    }),

    defineTool({
      name: 'habitat_rule_list',
      description: 'List all habitat rules.',
      schema: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['global', 'project'] },
        },
        required: ['scope'],
      },
      async handler(input: { scope: 'global' | 'project' }) {
        const svc = container.resolve(Tokens.HabitatFileService);
        return svc.list('rule', input.scope);
      },
    }),
  ];
}
