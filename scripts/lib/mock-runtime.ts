/**
 * MockWorkflowRuntime — 跳过 SDK/MCP/Attention 层，直接执行工作流函数。
 *
 * 满足 Orchestrator 对 WorkflowRuntime 的结构化类型要求：
 *   - execute(position, roleTemplate, task, abortController?)
 *   - buildMcpServers(position, memoryStore, roleTemplate)
 *   - invalidateWorkflow(workflowPath)
 */
import type { Position, RoleTemplate, Task } from '../../src/position/types.js';
import type { MemoryStore } from '../../src/memory/types.js';
import type { EventBus } from '../../src/orchestration/event-bus.js';
import type { AiResult } from '../../src/workflow/types.js';
import { WorkflowLoader } from '../../src/workflow/loader.js';
import { buildWorkflowContext, type WorkflowDependencies } from '../../src/workflow/context-builder.js';
import { TASK_EVENT_PREFIX } from '../../src/constants.js';

export interface MockRuntimeConfig {
  projectRoot: string;
  eventBus: EventBus;
  memoryStoreGetter: (positionId: string) => MemoryStore;
  globalMemoryStore: MemoryStore;
  logger: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
}

export class MockWorkflowRuntime {
  private loader: WorkflowLoader;

  constructor(private config: MockRuntimeConfig) {
    this.loader = new WorkflowLoader(config.projectRoot);
  }

  async execute(
    position: Position,
    roleTemplate: RoleTemplate,
    task: Task,
    abortController?: AbortController,
  ): Promise<{ costUsd: number }> {
    const ac = abortController ?? new AbortController();
    const workflowPath = position.config?.workflowPath ?? roleTemplate.workflowPath;

    // Load workflow function from disk (real WorkflowLoader)
    const workflowFn = await this.loader.load(workflowPath);

    const memoryStore = this.config.memoryStoreGetter(position.id);

    // Mock aiCall — workflows in this simulation don't use ctx.ai()
    const aiCall = async (_prompt: string): Promise<AiResult> => ({
      text: '[mock-ai-response]',
      sessionId: 'mock-session',
      costUsd: 0,
      durationMs: 0,
      numTurns: 0,
      status: 'success',
    });

    // Real emitFn — goes through EventBus, triggers Orchestrator wildcard handler
    const emitFn = async (taskType: string, payload: unknown, targetPositionId?: string) => {
      const event = this.config.eventBus.createEvent(
        `${TASK_EVENT_PREFIX}${taskType}`,
        position.id,
        payload,
        targetPositionId,
      );
      await this.config.eventBus.emit(event);
    };

    // Mock callFn — not used in this simulation
    const callFn = async (_target: string, _type: string, _payload: unknown): Promise<unknown> => {
      throw new Error('ctx.call() is not supported in simulation mode');
    };

    const deps: WorkflowDependencies = {
      position,
      roleTemplate,
      task,
      projectRoot: this.config.projectRoot,
      memoryStore,
      globalMemoryStore: this.config.globalMemoryStore,
      aiCall,
      emitFn,
      callFn,
      signal: ac.signal,
      logger: this.config.logger,
    };

    const ctx = buildWorkflowContext(deps);

    // Execute workflow function directly
    await workflowFn(ctx);

    return { costUsd: 0 };
  }

  async buildMcpServers(
    _position: Position,
    _memoryStore: MemoryStore,
    _roleTemplate: RoleTemplate,
  ): Promise<Record<string, unknown>> {
    return {}; // No MCP servers in simulation
  }

  invalidateWorkflow(workflowPath: string): void {
    this.loader.invalidate(workflowPath);
  }
}
