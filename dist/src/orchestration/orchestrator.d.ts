import type { OrchestratorStatus, ConcurrencyConfig } from './types.js';
import type { Position, Task, RoleTemplate } from '../position/types.js';
import type { PositionManager } from '../position/manager.js';
import type { WorkflowRuntime } from '../workflow/runtime.js';
import type { EventBus } from './event-bus.js';
import type { SessionManager } from '../ai/session-manager.js';
import type { MemoryStore } from '../memory/types.js';
import type { LogFn } from '../types.js';
export declare class Orchestrator {
    private positionManager;
    private workflowRuntime;
    private eventBus;
    private concurrency;
    private sessionManager?;
    private memoryStoreGetter?;
    private running;
    private positionSemaphore;
    private activeExecutions;
    private executionPromises;
    private completedTaskCount;
    private totalCostUsd;
    private wildcardHandler;
    private logger;
    constructor(positionManager: PositionManager, workflowRuntime: WorkflowRuntime, eventBus: EventBus, concurrency?: ConcurrencyConfig, sessionManager?: SessionManager | undefined, memoryStoreGetter?: ((positionId: string) => MemoryStore) | undefined, logger?: LogFn);
    start(): Promise<void>;
    stop(): Promise<void>;
    createPosition(roleTemplateName: string, config?: {
        positionId?: string;
        overrides?: Partial<RoleTemplate>;
    }): Promise<Position>;
    destroyPosition(positionId: string): Promise<void>;
    getPosition(positionId: string): Promise<Position | null>;
    listPositions(): Promise<Position[]>;
    dispatchTask(task: Omit<Task, 'id' | 'status' | 'createdAt'>): Promise<Task>;
    triggerPosition(positionId: string): Promise<void>;
    getStatus(): Promise<OrchestratorStatus>;
    private matchTaskType;
    private log;
}
//# sourceMappingURL=orchestrator.d.ts.map