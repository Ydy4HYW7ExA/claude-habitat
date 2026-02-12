import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { Orchestrator } from '../../src/orchestration/orchestrator.js';
import { EventBus } from '../../src/orchestration/event-bus.js';
import { PositionManager } from '../../src/position/manager.js';
import type { WorkflowRuntime } from '../../src/workflow/runtime.js';
import type { RoleTemplate, Position, Task } from '../../src/position/types.js';
import type { HabitatEvent } from '../../src/orchestration/types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { TASK_PRIORITY, TASK_STATUS, POSITION_STATUS, EVENT_TYPE, ID_PREFIX } from '../../src/constants.js';

interface ExecuteCall {
  position: Position;
  template: RoleTemplate;
  task: Task;
}

describe('Orchestrator', () => {
  let tmpDir: string;
  let positionManager: PositionManager;
  let eventBus: EventBus;
  let mockRuntime: WorkflowRuntime;
  let orchestrator: Orchestrator;
  let executeCalls: ExecuteCall[];

  const coderTemplate: RoleTemplate = {
    name: 'coder',
    description: 'Software engineer',
    workflowPath: 'workflows/coder.ts',
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'orch-test-'));
    positionManager = new PositionManager(tmpDir);
    eventBus = new EventBus(tmpDir);
    executeCalls = [];

    mockRuntime = {
      execute: vi.fn(async (position, template, task, ac) => {
        executeCalls.push({ position, template, task });
        return { costUsd: 0 };
      }),
      invalidateWorkflow: vi.fn(),
    } as unknown as WorkflowRuntime;

    orchestrator = new Orchestrator(positionManager, mockRuntime, eventBus, {
      maxConcurrentPositions: 2,
      maxConcurrentAiCalls: 1,
      positionTimeout: 10000,
    });

    await positionManager.registerRoleTemplate(coderTemplate);
  });

  afterEach(async () => {
    await orchestrator.stop();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should create and list positions', async () => {
    const pos = await orchestrator.createPosition('coder', { positionId: 'coder-01' });
    expect(pos.id).toBe('coder-01');

    const all = await orchestrator.listPositions();
    expect(all).toHaveLength(1);
  });

  it('should destroy a position', async () => {
    await orchestrator.createPosition('coder', { positionId: 'coder-01' });
    await orchestrator.destroyPosition('coder-01');

    const pos = await orchestrator.getPosition('coder-01');
    expect(pos).toBeNull();
  });

  it('should dispatch a task to a position', async () => {
    await orchestrator.createPosition('coder', { positionId: 'coder-01' });

    const task = await orchestrator.dispatchTask({
      sourcePositionId: 'orchestrator',
      targetPositionId: 'coder-01',
      type: 'implement',
      payload: { feature: 'login' },
      priority: TASK_PRIORITY.NORMAL,
    });

    expect(task.id).toMatch(new RegExp('^' + ID_PREFIX.TASK));
    expect(task.status).toBe(TASK_STATUS.PENDING);
  });

  it('should trigger position execution', async () => {
    await orchestrator.createPosition('coder', { positionId: 'coder-01' });
    await positionManager.enqueueTask('coder-01', {
      sourcePositionId: 'orchestrator',
      targetPositionId: 'coder-01',
      type: 'implement',
      payload: { feature: 'login' },
      priority: TASK_PRIORITY.NORMAL,
    });

    await orchestrator.triggerPosition('coder-01');

    // Wait for async execution
    await new Promise(r => setTimeout(r, 50));

    expect(mockRuntime.execute).toHaveBeenCalled();
  });

  it('should emit task.created event on dispatch', async () => {
    await orchestrator.createPosition('coder', { positionId: 'coder-01' });

    const events: HabitatEvent[] = [];
    eventBus.on(EVENT_TYPE.TASK_CREATED, async (event) => { events.push(event); });

    await orchestrator.dispatchTask({
      sourcePositionId: 'orchestrator',
      targetPositionId: 'coder-01',
      type: 'implement',
      payload: {},
      priority: TASK_PRIORITY.NORMAL,
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(EVENT_TYPE.TASK_CREATED);
  });

  it('should report status', async () => {
    const status = await orchestrator.getStatus();
    expect(status.running).toBe(false);
    expect(status.completedTasks).toBe(0);
  });

  it('should report status with position details', async () => {
    await orchestrator.createPosition('coder', { positionId: 'coder-01' });

    const status = await orchestrator.getStatus();
    expect(status.positions).toHaveLength(1);
    expect(status.positions[0].id).toBe('coder-01');
    expect(status.positions[0].status).toBe(POSITION_STATUS.IDLE);
  });

  it('should start and stop', async () => {
    await orchestrator.start();
    expect((await orchestrator.getStatus()).running).toBe(true);

    await orchestrator.stop();
    expect((await orchestrator.getStatus()).running).toBe(false);
  });

  it('should handle workflow execution errors gracefully', async () => {
    vi.mocked(mockRuntime.execute).mockRejectedValueOnce(new Error('Workflow failed'));

    await orchestrator.createPosition('coder', { positionId: 'coder-01' });
    await positionManager.enqueueTask('coder-01', {
      sourcePositionId: 'orchestrator',
      targetPositionId: 'coder-01',
      type: 'implement',
      payload: {},
      priority: TASK_PRIORITY.NORMAL,
    });

    const failEvents: HabitatEvent[] = [];
    eventBus.on(EVENT_TYPE.TASK_FAILED, async (event) => { failEvents.push(event); });

    await orchestrator.triggerPosition('coder-01');
    await new Promise(r => setTimeout(r, 50));

    expect(failEvents).toHaveLength(1);
    expect((failEvents[0].payload as Record<string, unknown>).error).toBe('Workflow failed');
  });

  it('should skip trigger if position is already busy', async () => {
    await orchestrator.createPosition('coder', { positionId: 'coder-01' });
    await positionManager.setStatus('coder-01', POSITION_STATUS.BUSY);

    await orchestrator.triggerPosition('coder-01');
    expect(mockRuntime.execute).not.toHaveBeenCalled();
  });

  it('should throw when triggering non-existent position', async () => {
    await expect(orchestrator.triggerPosition('nonexistent'))
      .rejects.toThrow('Position not found');
  });

  it('should skip route when condition throws', async () => {
    await orchestrator.createPosition('coder', { positionId: 'coder-01' });

    // Add an output route with a throwing condition
    const pos = await positionManager.getPosition('coder-01');
    pos!.outputRoutes.push({
      taskType: '*',
      targetPositionId: 'coder-01',
      condition: () => { throw new Error('condition boom'); },
    });
    await positionManager.updatePosition('coder-01', { outputRoutes: pos!.outputRoutes });

    await positionManager.enqueueTask('coder-01', {
      sourcePositionId: 'orchestrator',
      targetPositionId: 'coder-01',
      type: 'implement',
      payload: {},
      priority: TASK_PRIORITY.NORMAL,
    });

    // Should not throw — the route error is caught and skipped
    await orchestrator.triggerPosition('coder-01');
    await new Promise(r => setTimeout(r, 50));

    expect(mockRuntime.execute).toHaveBeenCalled();
  });

  it('should skip route when transform throws', async () => {
    await orchestrator.createPosition('coder', { positionId: 'coder-01' });

    const pos = await positionManager.getPosition('coder-01');
    pos!.outputRoutes.push({
      taskType: '*',
      targetPositionId: 'coder-01',
      transform: () => { throw new Error('transform boom'); },
    });
    await positionManager.updatePosition('coder-01', { outputRoutes: pos!.outputRoutes });

    await positionManager.enqueueTask('coder-01', {
      sourcePositionId: 'orchestrator',
      targetPositionId: 'coder-01',
      type: 'implement',
      payload: {},
      priority: TASK_PRIORITY.NORMAL,
    });

    await orchestrator.triggerPosition('coder-01');
    await new Promise(r => setTimeout(r, 50));

    expect(mockRuntime.execute).toHaveBeenCalled();
  });
});
