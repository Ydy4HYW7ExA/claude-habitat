import type { AttentionInput, AttentionOutput, AttentionStrategy } from '../types.js';
import { PROMPT, REQUEST_WORKFLOW_CHANGE_TOOL } from '../../constants.js';

/**
 * Priority 20 — Injects workflow source code into the prompt.
 * Lets the AI see and reason about its own workflow.
 */
export class WorkflowInjectionStrategy implements AttentionStrategy {
  name = 'workflow-injection';
  priority = 20;

  async enhance(input: AttentionInput): Promise<AttentionOutput> {
    const { context } = input;
    const { workflowSource } = context;

    if (!workflowSource) return input;

    const injection = [
      '',
      PROMPT.WORKFLOW_HEADER,
      '',
      PROMPT.WORKFLOW_DESCRIPTION,
      PROMPT.WORKFLOW_CHANGE_HINT(REQUEST_WORKFLOW_CHANGE_TOOL),
      '',
      '```typescript',
      workflowSource,
      '```',
    ].join('\n');

    return {
      ...input,
      prompt: input.prompt + injection,
    };
  }
}
