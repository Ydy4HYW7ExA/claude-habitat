import { describe, it, expect } from 'vitest';
import { RoleFramingStrategy } from '../../../src/attention/strategies/role-framing.js';
import { makeAttentionInput } from '../../fixtures/test-helpers.js';
import { PROMPT } from '../../../src/constants.js';
describe('RoleFramingStrategy', () => {
    const strategy = new RoleFramingStrategy();
    it('should have correct name and priority', () => {
        expect(strategy.name).toBe('role-framing');
        expect(strategy.priority).toBe(10);
    });
    it('should inject position identity into systemPromptAppend', async () => {
        const result = await strategy.enhance(makeAttentionInput('Do something', {
            roleTemplate: {
                name: 'coder',
                description: '高级软件工程师',
                workflowPath: 'workflows/coder.ts',
                systemPromptAppend: '遵循 TDD 开发流程。',
            },
        }));
        expect(result.systemPromptAppend).toContain('coder-01');
        expect(result.systemPromptAppend).toContain('高级软件工程师');
    });
    it('should inject task context', async () => {
        const result = await strategy.enhance(makeAttentionInput('Do something', {
            task: {
                id: 'task-001',
                sourcePositionId: 'orchestrator',
                targetPositionId: 'coder-01',
                type: 'implement',
                payload: { feature: 'login' },
                priority: 'high',
                status: 'running',
                createdAt: Date.now(),
            },
        }));
        expect(result.systemPromptAppend).toContain('implement');
        expect(result.systemPromptAppend).toContain('high');
        expect(result.systemPromptAppend).toContain('orchestrator');
    });
    it('should include systemPromptAppend from template', async () => {
        const result = await strategy.enhance(makeAttentionInput('Do something', {
            roleTemplate: {
                name: 'coder',
                description: '高级软件工程师',
                workflowPath: 'workflows/coder.ts',
                systemPromptAppend: '遵循 TDD 开发流程。',
            },
        }));
        expect(result.systemPromptAppend).toContain('TDD');
    });
    it('should not modify the prompt', async () => {
        const result = await strategy.enhance(makeAttentionInput('Do something'));
        expect(result.prompt).toBe('Do something');
    });
    it('should append to existing systemPromptAppend', async () => {
        const input = makeAttentionInput('Do something');
        input.systemPromptAppend = 'Existing content';
        const result = await strategy.enhance(input);
        expect(result.systemPromptAppend).toContain('Existing content');
        expect(result.systemPromptAppend).toContain('coder-01');
    });
    it('should inject todo items when present in context', async () => {
        const input = makeAttentionInput('Do something', {
            todoItems: [
                { text: '写测试', done: false },
                { text: '实现功能', done: true },
            ],
        });
        const result = await strategy.enhance(input);
        expect(result.systemPromptAppend).toContain(PROMPT.TODO_HEADER);
        expect(result.systemPromptAppend).toContain('- [ ] 写测试');
        expect(result.systemPromptAppend).toContain('- [x] 实现功能');
    });
    it('should not inject todo section when no items', async () => {
        const result = await strategy.enhance(makeAttentionInput('Do something'));
        expect(result.systemPromptAppend).not.toContain(PROMPT.TODO_HEADER);
    });
});
//# sourceMappingURL=role-framing.test.js.map