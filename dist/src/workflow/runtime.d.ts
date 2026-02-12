import type { AiResult } from './types.js';
import type { MemoryStore } from '../memory/types.js';
import type { Process, Program, Task } from '../position/types.js';
import type { AttentionEnhancer } from '../attention/enhancer.js';
import type { EventBus } from '../orchestration/event-bus.js';
import type { ProcessManager } from '../position/manager.js';
import type { SessionManager } from '../ai/session-manager.js';
export interface AiCaller {
    call(prompt: string, options: AiCallInternalOptions): Promise<AiResult>;
}
export interface AiCallInternalOptions {
    systemPromptAppend?: string;
    allowedTools?: string[];
    disallowedTools?: string[];
    model?: string;
    maxTurns?: number;
    maxBudgetUsd?: number;
    cwd?: string;
    resume?: string;
    fork?: boolean;
    outputFormat?: {
        type: 'json_schema';
        schema: Record<string, unknown>;
    };
    conversationHistory?: {
        role: 'user' | 'assistant';
        content: string;
    }[];
    mcpServers?: Record<string, unknown>;
    permissionMode?: string;
    extraMcpTools?: unknown[];
}
export interface WorkflowRuntimeConfig {
    projectRoot: string;
    aiCaller: AiCaller;
    attentionEnhancer: AttentionEnhancer;
    memoryStoreGetter: (positionId: string) => MemoryStore;
    globalMemoryStore: MemoryStore;
    eventBus: EventBus;
    positionManager: ProcessManager;
    emitFn: (taskType: string, payload: unknown, sourcePositionId: string, targetPositionId?: string) => Promise<void>;
    callFn: (targetPositionId: string, taskType: string, payload: unknown) => Promise<unknown>;
    logger: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
    sessionManager?: SessionManager;
}
export declare class WorkflowRuntime {
    private config;
    private loader;
    constructor(config: WorkflowRuntimeConfig);
    execute(position: Process, roleTemplate: Program, task: Task, abortController?: AbortController): Promise<{
        costUsd: number;
    }>;
    /**
     * Build MCP server configs for a position.
     * Every position gets memory + event tools.
     * org-architect also gets admin tools.
     */
    buildMcpServers(position: Process, memoryStore: MemoryStore, roleTemplate: Program): Promise<Record<string, unknown>>;
    invalidateWorkflow(workflowPath: string): void;
}
//# sourceMappingURL=runtime.d.ts.map