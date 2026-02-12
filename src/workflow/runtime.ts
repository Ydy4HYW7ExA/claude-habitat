import type { WorkflowFunction, AiOptions, AiResult } from './types.js';
import type { MemoryStore } from '../memory/types.js';
import type { Process, Program, Task } from '../position/types.js';
import type { AttentionEnhancer } from '../attention/enhancer.js';
import type { EventBus } from '../orchestration/event-bus.js';
import type { ProcessManager } from '../position/manager.js';
import type { SessionManager } from '../ai/session-manager.js';
import { WorkflowLoader } from './loader.js';
import { buildWorkflowContext, type WorkflowDependencies } from './context-builder.js';
import { createPositionMcpServer } from '../ai/mcp-tools.js';
import { createAdminMcpServer } from '../ai/admin-tools.js';
import { DEFAULT_PERMISSION_MODE, SESSION_STATUS } from '../constants.js';

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
  outputFormat?: { type: 'json_schema'; schema: Record<string, unknown> };
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
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

export class WorkflowRuntime {
  private loader: WorkflowLoader;

  constructor(private config: WorkflowRuntimeConfig) {
    this.loader = new WorkflowLoader(config.projectRoot);
  }

  async execute(
    position: Process,
    roleTemplate: Program,
    task: Task,
    abortController?: AbortController,
  ): Promise<{ costUsd: number }> {
    const ac = abortController ?? new AbortController();
    const memoryStore = this.config.memoryStoreGetter(position.id);
    const workflowPath = position.config?.workflowPath ?? roleTemplate.workflowPath;

    // Load workflow function
    const workflowFn = await this.loader.load(workflowPath);

    // Read workflow source for attention injection
    let workflowSource: string | undefined;
    try {
      workflowSource = await this.loader.getSource(workflowPath);
    } catch {
      // Non-critical: workflow source injection is optional
    }

    // Create MCP servers for this position
    const mcpServers = await this.buildMcpServers(position, memoryStore, roleTemplate);

    // Track accumulated cost across ai() calls
    let accumulatedCostUsd = 0;

    // Build the ai() function that goes through the attention pipeline
    const aiCall = async (prompt: string, options?: AiOptions): Promise<AiResult> => {
      const enhanced = await this.config.attentionEnhancer.enhance(prompt, {
        position,
        roleTemplate,
        task,
        workflowSource: (options?.injectWorkflowCode !== false) ? workflowSource : undefined,
        memoryStore,
        globalMemoryStore: this.config.globalMemoryStore,
      });

      let result: AiResult;
      const session = this.config.sessionManager?.getSession(position.id);

      if (session && session.status === SESSION_STATUS.READY) {
        // Persistent session path: send message to existing session
        result = await this.config.sessionManager!.sendAndWait(position.id, enhanced.prompt);
      } else {
        // Fallback path: one-shot query (current behavior, backward compatible)
        result = await this.config.aiCaller.call(enhanced.prompt, {
          systemPromptAppend: [
            roleTemplate.systemPromptAppend,
            enhanced.systemPromptAppend,
            options?.systemPromptAppend,
          ].filter(Boolean).join('\n\n'),
          allowedTools: options?.allowedTools ?? roleTemplate.allowedTools,
          disallowedTools: options?.disallowedTools ?? roleTemplate.disallowedTools,
          model: options?.model ?? roleTemplate.model,
          maxTurns: options?.maxTurns ?? roleTemplate.maxTurns,
          maxBudgetUsd: options?.maxBudgetUsd,
          cwd: position.workDir,
          resume: options?.resume,
          fork: options?.fork,
          outputFormat: options?.outputFormat,
          conversationHistory: enhanced.conversationHistory,
          mcpServers,
          permissionMode: roleTemplate.permissionMode ?? DEFAULT_PERMISSION_MODE,
          ...(options?.hooks ? { hooks: options.hooks as Record<string, unknown[]> } : {}),
        });
      }

      accumulatedCostUsd += result.costUsd;
      return result;
    };

    // Build emit/call wrappers
    const emitFn = async (taskType: string, payload: unknown, targetPositionId?: string) => {
      await this.config.emitFn(taskType, payload, position.id, targetPositionId);
    };

    const callFn = async (targetPositionId: string, taskType: string, payload: unknown) => {
      return this.config.callFn(targetPositionId, taskType, payload);
    };

    // Build context
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

    // Execute workflow
    await workflowFn(ctx);

    return { costUsd: accumulatedCostUsd };
  }

  /**
   * Build MCP server configs for a position.
   * Every position gets memory + event tools.
   * org-architect also gets admin tools.
   */
  async buildMcpServers(
    position: Process,
    memoryStore: MemoryStore,
    roleTemplate: Program,
  ): Promise<Record<string, unknown>> {
    const servers: Record<string, unknown> = {};

    // Process-level tools (memory, events)
    const positionServer = await createPositionMcpServer({
      memoryStore,
      globalMemoryStore: this.config.globalMemoryStore,
      eventBus: this.config.eventBus,
      position,
    });
    servers[positionServer.name] = positionServer;

    // Admin tools for positions with isAdmin flag
    if (roleTemplate.isAdmin) {
      const adminServer = await createAdminMcpServer({
        positionManager: this.config.positionManager,
        projectRoot: this.config.projectRoot,
      });
      servers[adminServer.name] = adminServer;
    }

    return servers;
  }

  invalidateWorkflow(workflowPath: string): void {
    this.loader.invalidate(workflowPath);
  }
}
