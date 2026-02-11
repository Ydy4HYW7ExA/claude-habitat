import type { Container } from '../../di/container.js';
import { Tokens } from '../../di/tokens.js';
import { defineTool, type ToolMetadata } from '../define-tool.js';
import type { SkillParser } from '../../domain/skill/parser.js';

export function registerSkillTools(container: Container): ToolMetadata[] {
  const parser = container.resolve(Tokens.SkillParser) as SkillParser;
  const tracker = container.resolve(Tokens.SessionTracker);

  return [
    defineTool({
      name: 'habitat_skill_resolve',
      description: 'Load and resolve a skill protocol with all imports.',
      schema: {
        type: 'object',
        properties: {
          skillName: { type: 'string' },
          resolveImports: { type: 'boolean' },
        },
        required: ['skillName'],
      },
      async handler(input: { skillName: string; resolveImports?: boolean }) {
        const result = await parser.resolve(input.skillName, input.resolveImports ?? true);
        tracker.recordSkillInvocation({
          skillName: input.skillName,
          toolName: 'habitat_skill_resolve',
          timestamp: Date.now(),
        });
        return result;
      },
    }),
  ];
}
