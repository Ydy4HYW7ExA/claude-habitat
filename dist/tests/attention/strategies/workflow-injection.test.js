import { describe, it, expect } from 'vitest';
import { WorkflowInjectionStrategy } from '../../../src/attention/strategies/workflow-injection.js';
import { makeAttentionInput } from '../../fixtures/test-helpers.js';
import { PROMPT, REQUEST_WORKFLOW_CHANGE_TOOL } from '../../../src/constants.js';
function makeInputWithSource(workflowSource) {
    const input = makeAttentionInput('Do something');
    input.context.workflowSource = workflowSource;
    return input;
}
describe('WorkflowInjectionStrategy', () => {
    const strategy = new WorkflowInjectionStrategy();
    it('should have correct name and priority', () => {
        expect(strategy.name).toBe('workflow-injection');
        expect(strategy.priority).toBe(20);
    });
    it('should inject workflow source into prompt', async () => {
        const source = 'export default async function(ctx) { await ctx.ai("hello"); }';
        const result = await strategy.enhance(makeInputWithSource(source));
        expect(result.prompt).toContain(PROMPT.WORKFLOW_HEADER);
        expect(result.prompt).toContain(source);
        expect(result.prompt).toContain('```typescript');
    });
    it('should not modify prompt when no workflow source', async () => {
        const result = await strategy.enhance(makeInputWithSource(undefined));
        expect(result.prompt).toBe('Do something');
    });
    it('should mention request_workflow_change tool', async () => {
        const result = await strategy.enhance(makeInputWithSource('some code'));
        expect(result.prompt).toContain(REQUEST_WORKFLOW_CHANGE_TOOL);
    });
});
//# sourceMappingURL=workflow-injection.test.js.map