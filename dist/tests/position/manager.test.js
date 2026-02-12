import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProcessManager } from '../../src/position/manager.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { POSITION_STATUS, TASK_STATUS, TASK_PRIORITY, MODEL, ID_PREFIX } from '../../src/constants.js';
describe('ProcessManager', () => {
    let tmpDir;
    let manager;
    const coderTemplate = {
        name: 'coder',
        description: '高级软件工程师，负责编写高质量的 TypeScript 代码。',
        workflowPath: 'program/app/coder/workflow.mjs',
        model: MODEL.SONNET,
        maxTurns: 30,
        systemPromptAppend: '遵循 TDD 开发流程。',
        rules: [
            { name: 'typescript', paths: ['*.ts', '*.tsx'], content: '使用 strict 模式。' },
        ],
    };
    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mgr-test-'));
        manager = new ProcessManager(tmpDir);
        await manager.registerProgram(coderTemplate);
    });
    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
    describe('Role Template Management', () => {
        it('should register and retrieve a role template', async () => {
            const loaded = await manager.getProgram('coder');
            expect(loaded).not.toBeNull();
            expect(loaded.name).toBe('coder');
            expect(loaded.description).toContain('TypeScript');
        });
        it('should list all role templates', async () => {
            await manager.registerProgram({
                name: 'reviewer',
                description: 'Code reviewer',
                workflowPath: 'program/app/reviewer/workflow.mjs',
            });
            const all = await manager.listPrograms();
            expect(all).toHaveLength(2);
        });
        it('should delete a role template', async () => {
            await manager.deleteProgram('coder');
            const result = await manager.getProgram('coder');
            expect(result).toBeNull();
        });
    });
    describe('Position Management', () => {
        it('should create a position from a template', async () => {
            const pos = await manager.createProcess('coder', 'coder-01');
            expect(pos.id).toBe('coder-01');
            expect(pos.programName).toBe('coder');
            expect(pos.status).toBe(POSITION_STATUS.IDLE);
            expect(pos.taskQueue).toEqual([]);
        });
        it('should generate a CLAUDE.md file', async () => {
            const pos = await manager.createProcess('coder', 'coder-01');
            const claudeMd = await fs.readFile(path.join(pos.workDir, 'CLAUDE.md'), 'utf-8');
            expect(claudeMd).toContain('coder-01');
            expect(claudeMd).toContain('remember');
            expect(claudeMd).toContain('recall');
        });
        it('should generate rule files', async () => {
            const pos = await manager.createProcess('coder', 'coder-01');
            const ruleContent = await fs.readFile(path.join(pos.workDir, 'rules', 'typescript.md'), 'utf-8');
            expect(ruleContent).toContain('*.ts');
            expect(ruleContent).toContain('strict');
        });
        it('should auto-generate position ID if not provided', async () => {
            const pos = await manager.createProcess('coder');
            expect(pos.id).toMatch(/^coder-/);
        });
        it('should throw when template not found', async () => {
            await expect(manager.createProcess('nonexistent'))
                .rejects.toThrow('Program not found');
        });
        it('should get and list positions', async () => {
            await manager.createProcess('coder', 'coder-01');
            await manager.createProcess('coder', 'coder-02');
            const pos = await manager.getProcess('coder-01');
            expect(pos).not.toBeNull();
            expect(pos.id).toBe('coder-01');
            const all = await manager.listProcesses();
            expect(all).toHaveLength(2);
        });
        it('should update position fields', async () => {
            await manager.createProcess('coder', 'coder-01');
            const updated = await manager.updateProcess('coder-01', { status: POSITION_STATUS.BUSY });
            expect(updated.status).toBe(POSITION_STATUS.BUSY);
            expect(updated.updatedAt).toBeGreaterThan(updated.createdAt);
        });
        it('should set position status', async () => {
            await manager.createProcess('coder', 'coder-01');
            await manager.setStatus('coder-01', POSITION_STATUS.ERROR);
            const pos = await manager.getProcess('coder-01');
            expect(pos.status).toBe(POSITION_STATUS.ERROR);
        });
        it('should destroy a position', async () => {
            await manager.createProcess('coder', 'coder-01');
            await manager.destroyProcess('coder-01');
            const pos = await manager.getProcess('coder-01');
            expect(pos).toBeNull();
        });
    });
    describe('Task Management', () => {
        it('should enqueue and dequeue tasks', async () => {
            await manager.createProcess('coder', 'coder-01');
            const task = await manager.enqueueTask('coder-01', {
                sourcePositionId: 'orchestrator',
                targetPositionId: 'coder-01',
                type: 'implement',
                payload: { feature: 'login' },
                priority: TASK_PRIORITY.NORMAL,
            });
            expect(task.id).toMatch(new RegExp('^' + ID_PREFIX.TASK));
            expect(task.status).toBe(TASK_STATUS.PENDING);
            const dequeued = await manager.dequeueTask('coder-01');
            expect(dequeued).not.toBeNull();
            expect(dequeued.id).toBe(task.id);
            expect(dequeued.status).toBe(TASK_STATUS.RUNNING);
        });
        it('should dequeue by priority order', async () => {
            await manager.createProcess('coder', 'coder-01');
            await manager.enqueueTask('coder-01', {
                sourcePositionId: 'x',
                targetPositionId: 'coder-01',
                type: 'low-task',
                payload: {},
                priority: TASK_PRIORITY.LOW,
            });
            await manager.enqueueTask('coder-01', {
                sourcePositionId: 'x',
                targetPositionId: 'coder-01',
                type: 'critical-task',
                payload: {},
                priority: TASK_PRIORITY.CRITICAL,
            });
            const dequeued = await manager.dequeueTask('coder-01');
            expect(dequeued.type).toBe('critical-task');
        });
        it('should complete a task', async () => {
            await manager.createProcess('coder', 'coder-01');
            const task = await manager.enqueueTask('coder-01', {
                sourcePositionId: 'x',
                targetPositionId: 'coder-01',
                type: 'implement',
                payload: {},
                priority: TASK_PRIORITY.NORMAL,
            });
            await manager.dequeueTask('coder-01');
            await manager.completeTask('coder-01', task.id, { success: true });
            const pos = await manager.getProcess('coder-01');
            const completed = pos.taskQueue.find(t => t.id === task.id);
            expect(completed.status).toBe(TASK_STATUS.DONE);
            expect(completed.result).toEqual({ success: true });
            expect(pos.currentTask).toBeUndefined();
        });
        it('should fail a task', async () => {
            await manager.createProcess('coder', 'coder-01');
            const task = await manager.enqueueTask('coder-01', {
                sourcePositionId: 'x',
                targetPositionId: 'coder-01',
                type: 'implement',
                payload: {},
                priority: TASK_PRIORITY.NORMAL,
            });
            await manager.dequeueTask('coder-01');
            await manager.failTask('coder-01', task.id, 'Something went wrong');
            const pos = await manager.getProcess('coder-01');
            const failed = pos.taskQueue.find(t => t.id === task.id);
            expect(failed.status).toBe(TASK_STATUS.FAILED);
        });
        it('should return null when no pending tasks', async () => {
            await manager.createProcess('coder', 'coder-01');
            const result = await manager.dequeueTask('coder-01');
            expect(result).toBeNull();
        });
    });
    describe('Output Routes', () => {
        it('should add output routes', async () => {
            await manager.createProcess('coder', 'coder-01');
            await manager.addOutputRoute('coder-01', {
                taskType: 'code-review',
                targetPositionId: 'reviewer-01',
            });
            const pos = await manager.getProcess('coder-01');
            expect(pos.outputRoutes).toHaveLength(1);
            expect(pos.outputRoutes[0].taskType).toBe('code-review');
        });
    });
});
//# sourceMappingURL=manager.test.js.map