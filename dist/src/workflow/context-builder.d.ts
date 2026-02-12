import type { WorkflowContext, AiOptions, AiResult } from './types.js';
import type { MemoryStore } from '../memory/types.js';
import type { Position, RoleTemplate, Task } from '../position/types.js';
export interface WorkflowDependencies {
    position: Position;
    roleTemplate: RoleTemplate;
    task: Task;
    projectRoot: string;
    memoryStore: MemoryStore;
    globalMemoryStore: MemoryStore;
    aiCall: (prompt: string, options?: AiOptions) => Promise<AiResult>;
    emitFn: (taskType: string, payload: unknown, targetPositionId?: string) => Promise<void>;
    callFn: (targetPositionId: string, taskType: string, payload: unknown) => Promise<unknown>;
    signal: AbortSignal;
    logger: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
}
export declare function buildWorkflowContext(deps: WorkflowDependencies): WorkflowContext;
//# sourceMappingURL=context-builder.d.ts.map