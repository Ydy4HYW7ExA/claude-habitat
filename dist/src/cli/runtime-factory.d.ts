import { ProcessManager } from '../position/manager.js';
import { FileMemoryStoreFactory } from '../memory/factory.js';
import { WorkflowRuntime } from '../workflow/runtime.js';
import { SessionManager } from '../ai/session-manager.js';
import { EventBus } from '../orchestration/event-bus.js';
import { Orchestrator } from '../orchestration/orchestrator.js';
import type { LogFn } from '../types.js';
export type { LogFn } from '../types.js';
export interface HabitatRuntime {
    positionManager: ProcessManager;
    memoryFactory: FileMemoryStoreFactory;
    eventBus: EventBus;
    orchestrator: Orchestrator;
    workflowRuntime: WorkflowRuntime;
    sessionManager?: SessionManager;
    config: Record<string, unknown>;
    logger: LogFn;
}
export interface RuntimeOptions {
    /** Override AI defaults (e.g. bootstrap uses opus/50 turns/5.0 USD) */
    aiDefaults?: {
        model?: string;
        maxTurns?: number;
        maxBudgetUsd?: number;
    };
    /**
     * Which attention strategies to register.
     * 'full' = all 5 strategies (default for run).
     * 'minimal' = role-framing + memory-retrieval + context-budget
     *   (bootstrap skips workflow-injection and history-construction
     *    because the org-architect has no prior history to construct
     *    and its workflow is already in the prompt context).
     */
    attentionMode?: 'full' | 'minimal';
    /** Custom callFn for the workflow runtime. Defaults to no-op. */
    callFn?: (targetPositionId: string, taskType: string, payload: unknown) => Promise<unknown>;
    /** Enable persistent sessions for background positions. */
    enableSessions?: boolean;
}
export declare const defaultLogger: LogFn;
/**
 * Verify that the project has been initialized.
 * Throws a user-facing error message and exits if not.
 */
export declare function ensureInitialized(projectRoot: string): Promise<string>;
/**
 * Create a fully-wired HabitatRuntime from a project root.
 * This is the composition root — all subsystems are assembled here.
 */
export declare function createHabitatRuntime(projectRoot: string, options?: RuntimeOptions): Promise<HabitatRuntime>;
/**
 * Register graceful shutdown handlers for SIGINT/SIGTERM.
 */
export declare function onShutdown(orchestrator: Orchestrator): void;
//# sourceMappingURL=runtime-factory.d.ts.map