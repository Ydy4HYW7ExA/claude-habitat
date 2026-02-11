import type { Container } from '../../di/container.js';
import { Tokens } from '../../di/tokens.js';
import { defineTool, type ToolMetadata } from '../define-tool.js';

export function registerHabitatSkillTools(container: Container): ToolMetadata[] {
  return [
    defineTool({
      name: 'habitat_skill_create',
      description: 'Create a habitat skill file.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Skill name (must start with habitat-, kebab-case)' },
          content: { type: 'string', description: 'Markdown content of the skill' },
          scope: { type: 'string', enum: ['global', 'project'], description: 'Scope: global or project' },
        },
        required: ['name', 'content', 'scope'],
      },
      async handler(input: { name: string; content: string; scope: 'global' | 'project' }) {
        const svc = container.resolve(Tokens.HabitatFileService);
        return svc.create({ ...input, kind: 'skill' });
      },
    }),

    defineTool({
      name: 'habitat_skill_read',
      description: 'Read a habitat skill file.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Skill name' },
          scope: { type: 'string', enum: ['global', 'project'] },
        },
        required: ['name', 'scope'],
      },
      async handler(input: { name: string; scope: 'global' | 'project' }) {
        const svc = container.resolve(Tokens.HabitatFileService);
        return svc.read(input.name, 'skill', input.scope);
      },
    }),

    defineTool({
      name: 'habitat_skill_update',
      description: 'Update a habitat skill file.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Skill name' },
          content: { type: 'string', description: 'New markdown content' },
          scope: { type: 'string', enum: ['global', 'project'] },
        },
        required: ['name', 'content', 'scope'],
      },
      async handler(input: { name: string; content: string; scope: 'global' | 'project' }) {
        const svc = container.resolve(Tokens.HabitatFileService);
        return svc.update({ ...input, kind: 'skill' });
      },
    }),

    defineTool({
      name: 'habitat_skill_delete',
      description: 'Delete a habitat skill and its symlink.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Skill name' },
          scope: { type: 'string', enum: ['global', 'project'] },
        },
        required: ['name', 'scope'],
      },
      async handler(input: { name: string; scope: 'global' | 'project' }) {
        const svc = container.resolve(Tokens.HabitatFileService);
        await svc.delete(input.name, 'skill', input.scope);
        return { deleted: input.name };
      },
    }),

    defineTool({
      name: 'habitat_skill_list',
      description: 'List all habitat skills.',
      schema: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['global', 'project'] },
        },
        required: ['scope'],
      },
      async handler(input: { scope: 'global' | 'project' }) {
        const svc = container.resolve(Tokens.HabitatFileService);
        return svc.list('skill', input.scope);
      },
    }),
  ];
}
