import { WorkflowLoader } from './loader.js';
import { buildWorkflowContext } from './context-builder.js';
import { createPositionMcpServer } from '../ai/mcp-tools.js';
import { createAdminMcpServer } from '../ai/admin-tools.js';
import { DEFAULT_PERMISSION_MODE, SESSION_STATUS } from '../constants.js';
export class WorkflowRuntime {
    config;
    loader;
    constructor(config) {
        this.config = config;
        this.loader = new WorkflowLoader(config.projectRoot);
    }
    async execute(position, roleTemplate, task, abortController) {
        const ac = abortController ?? new AbortController();
        const memoryStore = this.config.memoryStoreGetter(position.id);
        const workflowPath = position.config?.workflowPath ?? roleTemplate.workflowPath;
        // Load workflow function
        const workflowFn = await this.loader.load(workflowPath);
        // Read workflow source for attention injection
        let workflowSource;
        try {
            workflowSource = await this.loader.getSource(workflowPath);
        }
        catch {
            // Non-critical: workflow source injection is optional
        }
        // Create MCP servers for this position
        const mcpServers = await this.buildMcpServers(position, memoryStore, roleTemplate);
        // Track accumulated cost across ai() calls
        let accumulatedCostUsd = 0;
        // Build the ai() function that goes through the attention pipeline
        const aiCall = async (prompt, options) => {
            const enhanced = await this.config.attentionEnhancer.enhance(prompt, {
                position,
                roleTemplate,
                task,
                workflowSource: (options?.injectWorkflowCode !== false) ? workflowSource : undefined,
                memoryStore,
                globalMemoryStore: this.config.globalMemoryStore,
            });
            let result;
            const session = this.config.sessionManager?.getSession(position.id);
            if (session && session.status === SESSION_STATUS.READY) {
                // Persistent session path: send message to existing session
                result = await this.config.sessionManager.sendAndWait(position.id, enhanced.prompt);
            }
            else {
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
                    ...(options?.hooks ? { hooks: options.hooks } : {}),
                });
            }
            accumulatedCostUsd += result.costUsd;
            return result;
        };
        // Build emit/call wrappers
        const emitFn = async (taskType, payload, targetPositionId) => {
            await this.config.emitFn(taskType, payload, position.id, targetPositionId);
        };
        const callFn = async (targetPositionId, taskType, payload) => {
            return this.config.callFn(targetPositionId, taskType, payload);
        };
        // Build context
        const deps = {
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
    async buildMcpServers(position, memoryStore, roleTemplate) {
        const servers = {};
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
    invalidateWorkflow(workflowPath) {
        this.loader.invalidate(workflowPath);
    }
}
//# sourceMappingURL=runtime.js.map