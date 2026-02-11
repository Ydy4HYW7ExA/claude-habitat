import type { Container } from '../../di/container.js';
import { Tokens } from '../../di/tokens.js';
import { defineTool, type ToolMetadata } from '../define-tool.js';

export function registerSessionTools(container: Container): ToolMetadata[] {
  const tracker = container.resolve(Tokens.SessionTracker);

  return [
    defineTool({
      name: 'habitat_session_stats',
      description:
        'Get rule trigger and skill invocation stats for the current MCP session. ' +
        'Use format=markdown for Plan Mode injection.',
      schema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['json', 'markdown'],
            description: 'Output format. markdown is optimized for Plan Mode injection.',
          },
        },
      },
      async handler(input: { format?: string }) {
        if (input.format === 'markdown') {
          const text = tracker.formatForInjection();
          return { formatted: text || 'No rule or skill activity recorded in this session.' };
        }
        const stats = tracker.getStats();
        return {
          ruleTriggers: Object.fromEntries(stats.ruleTriggers),
          skillInvocations: Object.fromEntries(stats.skillInvocations),
          unmatchedRules: stats.unmatchedRules,
          totalToolCalls: stats.totalToolCalls,
          sessionStartTime: stats.sessionStartTime,
        };
      },
    }),
  ];
}
