import type { OrchestratorStatus, ConcurrencyConfig } from './types.js';
import type { Process, Task, Program } from '../position/types.js';
import type { ProcessManager } from '../position/manager.js';
import type { WorkflowRuntime } from '../workflow/runtime.js';
import type { EventBus } from './event-bus.js';
import type { HabitatEvent, EventHandler } from './types.js';
import type { SessionManager } from '../ai/session-manager.js';
import type { MemoryStore } from '../memory/types.js';
import type { LogFn } from '../types.js';
import { Semaphore } from './semaphore.js';
import {
  formatTimestamp, DEFAULT_CONCURRENCY_CONFIG, TASK_CREATED_TYPE, TASK_EVENT_PREFIX,
  POSITION_STATUS, TASK_STATUS, TASK_PRIORITY, EVENT_TYPE, EVENT_WILDCARD,
} from '../constants.js';

export class Orchestrator {
  private running = false;
  private positionSemaphore: Semaphore;
  private activeExecutions = new Map<string, AbortController>();
  private executionPromises = new Map<string, Promise<void>>();
  private completedTaskCount = 0;
  private totalCostUsd = 0;
  private wildcardHandler: EventHandler | null = null;
  private logger: LogFn;

  constructor(
    private positionManager: ProcessManager,
    private workflowRuntime: WorkflowRuntime,
    private eventBus: EventBus,
    private concurrency: ConcurrencyConfig = DEFAULT_CONCURRENCY_CONFIG,
    private sessionManager?: SessionManager,
    private memoryStoreGetter?: (positionId: string) => MemoryStore,
    logger?: LogFn,
  ) {
    this.positionSemaphore = new Semaphore(concurrency.maxConcurrentPositions);
    this.logger = logger ?? ((level, message) => {
      const ts = formatTimestamp();
      if (level === 'error') {
        console.error(`[${ts}] [${level}] ${message}`);
      } else {
        console.log(`[${ts}] [${level}] ${message}`);
      }
    });
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Subscribe to task events for routing
    this.wildcardHandler = async (event: HabitatEvent) => {
      if (event.type.startsWith(TASK_EVENT_PREFIX) && event.targetPositionId) {
        const taskType = event.type.replace(TASK_EVENT_PREFIX, '');
        // Avoid re-dispatching task.created events
        if (taskType === TASK_CREATED_TYPE) return;
        const eventPayload = event.payload as Record<string, unknown> | undefined;
        const priority = (eventPayload?.priority as string) ?? TASK_PRIORITY.NORMAL;
        await this.dispatchTask({
          sourcePositionId: event.sourcePositionId,
          targetPositionId: event.targetPositionId,
          type: taskType,
          payload: event.payload,
          priority: priority as 'low' | 'normal' | 'high' | 'critical',
        });
      }
    };
    this.eventBus.on(EVENT_WILDCARD, this.wildcardHandler);
  }

  async stop(): Promise<void> {
    this.running = false;

    // Unregister event handler to prevent leaks
    if (this.wildcardHandler) {
      this.eventBus.off(EVENT_WILDCARD, this.wildcardHandler);
      this.wildcardHandler = null;
    }

    // Abort all active executions
    for (const [, ac] of this.activeExecutions) {
      ac.abort();
    }
    this.activeExecutions.clear();

    // Await all active execution promises to settle
    const pending = [...this.executionPromises.values()];
    if (pending.length > 0) {
      await Promise.allSettled(pending);
    }
    this.executionPromises.clear();
  }

  async createPosition(
    programName: string,
    config?: { positionId?: string; overrides?: Partial<Program> },
  ): Promise<Process> {
    return this.positionManager.createProcess(
      programName,
      config?.positionId,
      config?.overrides,
    );
  }

  async destroyPosition(positionId: string): Promise<void> {
    // Abort if running
    const ac = this.activeExecutions.get(positionId);
    if (ac) {
      ac.abort();
      this.activeExecutions.delete(positionId);
    }
    await this.positionManager.destroyProcess(positionId);
  }

  getPosition(positionId: string): Promise<Process | null> {
    return this.positionManager.getProcess(positionId);
  }

  async listPositions(): Promise<Process[]> {
    return this.positionManager.listProcesses();
  }

  async dispatchTask(task: Omit<Task, 'id' | 'status' | 'createdAt'>): Promise<Task> {
    // Validate target position exists before enqueueing
    const targetPos = await this.positionManager.getProcess(task.targetPositionId);
    if (!targetPos) {
      throw new Error(`Cannot dispatch task: target position '${task.targetPositionId}' not found`);
    }

    const created = await this.positionManager.enqueueTask(task.targetPositionId, task);

    await this.eventBus.emit(
      this.eventBus.createEvent(EVENT_TYPE.TASK_CREATED, task.sourcePositionId, {
        taskId: created.id,
        targetPositionId: task.targetPositionId,
        type: task.type,
      }, task.targetPositionId),
    );

    // Auto-trigger if orchestrator is running
    if (this.running) {
      this.triggerPosition(task.targetPositionId).catch((err) => {
        this.log('warn', `Failed to trigger position ${task.targetPositionId}: ${err}`);
      });
    }

    return created;
  }

  async triggerPosition(positionId: string): Promise<void> {
    const position = await this.positionManager.getProcess(positionId);
    if (!position) throw new Error(`Process not found: ${positionId}`);
    if (position.status === POSITION_STATUS.BUSY) return; // Already running

    const task = await this.positionManager.dequeueTask(positionId);
    if (!task) return; // No pending tasks

    const template = await this.positionManager.getProgram(position.programName);
    if (!template) throw new Error(`Program not found: ${position.programName}`);

    await this.positionManager.setStatus(positionId, POSITION_STATUS.BUSY);

    const ac = new AbortController();
    this.activeExecutions.set(positionId, ac);

    // Set up timeout
    const timeout = setTimeout(() => {
      ac.abort();
    }, this.concurrency.positionTimeout);

    // Execute within semaphore
    const executionPromise = this.positionSemaphore.withLock(async () => {
      try {
        // On-demand: start persistent session if sessionManager is configured
        if (this.sessionManager && this.memoryStoreGetter && !this.sessionManager.getSession(positionId)) {
          const memoryStore = this.memoryStoreGetter(positionId);
          const mcpServers = await this.workflowRuntime.buildMcpServers(position, memoryStore, template);
          await this.sessionManager.startSession(position, template, mcpServers);
        }

        const { costUsd } = await this.workflowRuntime.execute(position, template, task, ac);
        this.totalCostUsd += costUsd;

        await this.positionManager.completeTask(positionId, task.id, {
          taskType: task.type,
          completedAt: Date.now(),
        });
        this.completedTaskCount++;

        await this.eventBus.emit(
          this.eventBus.createEvent(EVENT_TYPE.TASK_COMPLETED, positionId, {
            taskId: task.id,
            type: task.type,
          }),
        );

        // Check for output routes
        const pos = await this.positionManager.getProcess(positionId);
        if (pos) {
          for (const route of pos.outputRoutes) {
            if (this.matchTaskType(task.type, route.taskType)) {
              let shouldRoute: boolean;
              try {
                shouldRoute = route.condition ? route.condition(task.result) : true;
              } catch (condErr) {
                this.log('warn', `Route condition error for ${positionId} → ${route.targetPositionId}: ${condErr}`);
                continue;
              }
              if (shouldRoute) {
                let payload: unknown;
                try {
                  payload = route.transform ? route.transform(task.result) : task.result;
                } catch (transformErr) {
                  this.log('warn', `Route transform error for ${positionId} → ${route.targetPositionId}: ${transformErr}`);
                  continue;
                }
                await this.dispatchTask({
                  sourcePositionId: positionId,
                  targetPositionId: route.targetPositionId,
                  type: task.type,
                  payload,
                  priority: task.priority,
                });
              }
            }
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await this.positionManager.failTask(positionId, task.id, errorMsg);
        await this.positionManager.setStatus(positionId, POSITION_STATUS.ERROR);

        await this.eventBus.emit(
          this.eventBus.createEvent(EVENT_TYPE.TASK_FAILED, positionId, {
            taskId: task.id,
            type: task.type,
            error: errorMsg,
          }),
        );
      } finally {
        clearTimeout(timeout);
        this.activeExecutions.delete(positionId);
        const currentPos = await this.positionManager.getProcess(positionId);
        if (currentPos && currentPos.status === POSITION_STATUS.BUSY) {
          await this.positionManager.setStatus(positionId, POSITION_STATUS.IDLE);
        }

        // Re-trigger if more pending tasks (don't dequeue here — triggerPosition does it)
        if (this.running) {
          const pos = await this.positionManager.getProcess(positionId);
          const hasPending = pos?.taskQueue.some(t => t.status === TASK_STATUS.PENDING);
          if (hasPending) {
            this.triggerPosition(positionId).catch((err) => {
              this.log('warn', `Failed to re-trigger position ${positionId}: ${err}`);
            });
          }
        }
      }
    }).catch((err) => {
      this.log('error', `Semaphore error for position ${positionId}: ${err}`);
    }).finally(() => {
      this.executionPromises.delete(positionId);
    });

    this.executionPromises.set(positionId, executionPromise);
  }

  async getStatus(): Promise<OrchestratorStatus> {
    const allPositions = await this.positionManager.listProcesses();
    let pendingTasks = 0;

    const positions = allPositions.map(p => {
      const pending = p.taskQueue.filter(t => t.status === TASK_STATUS.PENDING).length;
      pendingTasks += pending;
      return {
        id: p.id,
        status: p.status,
        currentTask: p.currentTask?.id,
      };
    });

    return {
      running: this.running,
      positions,
      pendingTasks,
      completedTasks: this.completedTaskCount,
      totalCostUsd: this.totalCostUsd,
    };
  }

  private matchTaskType(actual: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return actual.startsWith(pattern.slice(0, -1));
    }
    return actual === pattern;
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    this.logger(level, message);
  }
}
