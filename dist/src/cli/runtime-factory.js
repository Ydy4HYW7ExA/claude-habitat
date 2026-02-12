import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { ProcessManager } from '../position/manager.js';
import { FileMemoryStoreFactory } from '../memory/factory.js';
import { AttentionEnhancer } from '../attention/enhancer.js';
import { RoleFramingStrategy } from '../attention/strategies/role-framing.js';
import { WorkflowInjectionStrategy } from '../attention/strategies/workflow-injection.js';
import { MemoryRetrievalStrategy } from '../attention/strategies/memory-retrieval.js';
import { HistoryConstructionStrategy } from '../attention/strategies/history-construction.js';
import { ContextBudgetStrategy } from '../attention/strategies/context-budget.js';
import { WorkflowRuntime } from '../workflow/runtime.js';
import { AiClient } from '../ai/client.js';
import { SessionManager } from '../ai/session-manager.js';
import { EventBus } from '../orchestration/event-bus.js';
import { Orchestrator } from '../orchestration/orchestrator.js';
import { HABITAT_DIR, CONFIG_FILE, DATA_DIR, formatTimestamp, DEFAULT_AI_MODEL, DEFAULT_AI_MAX_TURNS, DEFAULT_AI_MAX_BUDGET_USD, TASK_EVENT_PREFIX } from '../constants.js';
const INSTALL_INFO_FILE = '.claude-habitat.json';
/**
 * Load credentials from ~/.claude-habitat/.claude-habitat.json
 * and inject into process.env if not already set.
 */
async function loadCredentials() {
    if (process.env.ANTHROPIC_API_KEY)
        return; // already set
    const infoPath = path.join(os.homedir(), HABITAT_DIR, INSTALL_INFO_FILE);
    try {
        const data = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
        const creds = data?.credentials;
        if (!creds)
            return;
        if (creds.apiKey && !process.env.ANTHROPIC_API_KEY) {
            process.env.ANTHROPIC_API_KEY = creds.apiKey;
        }
        if (creds.baseUrl && !process.env.ANTHROPIC_BASE_URL) {
            process.env.ANTHROPIC_BASE_URL = creds.baseUrl;
        }
    }
    catch {
        // No credentials file or parse error — SDK will use its own fallbacks
    }
}
export const defaultLogger = (level, message) => {
    const ts = formatTimestamp();
    const out = level === 'error' ? console.error : console.log;
    out(`[${ts}] [${level}] ${message}`);
};
/**
 * Verify that the project has been initialized.
 * Throws a user-facing error message and exits if not.
 */
export async function ensureInitialized(projectRoot) {
    const habitatDir = path.join(projectRoot, HABITAT_DIR);
    try {
        await fs.access(path.join(habitatDir, CONFIG_FILE));
    }
    catch {
        console.error('Project not initialized. Run: claude-habitat init');
        process.exit(1);
    }
    return habitatDir;
}
/**
 * Create a fully-wired HabitatRuntime from a project root.
 * This is the composition root — all subsystems are assembled here.
 */
export async function createHabitatRuntime(projectRoot, options = {}) {
    const habitatDir = path.join(projectRoot, HABITAT_DIR);
    // Load credentials from ~/.claude-habitat/.claude-habitat.json
    await loadCredentials();
    const configData = await fs.readFile(path.join(habitatDir, CONFIG_FILE), 'utf-8');
    const config = JSON.parse(configData);
    const positionManager = new ProcessManager(habitatDir);
    const memoryFactory = new FileMemoryStoreFactory(path.join(habitatDir, DATA_DIR));
    const eventBus = new EventBus(habitatDir);
    // Attention enhancer
    const attentionEnhancer = new AttentionEnhancer();
    attentionEnhancer.register(new RoleFramingStrategy());
    if (options.attentionMode !== 'minimal') {
        attentionEnhancer.register(new WorkflowInjectionStrategy());
    }
    attentionEnhancer.register(new MemoryRetrievalStrategy());
    if (options.attentionMode !== 'minimal') {
        attentionEnhancer.register(new HistoryConstructionStrategy());
    }
    attentionEnhancer.register(new ContextBudgetStrategy());
    // AI client
    const aiDefaults = options.aiDefaults ?? {};
    const aiClient = new AiClient({
        defaultModel: String(aiDefaults.model ?? config.defaultModel ?? DEFAULT_AI_MODEL),
        defaultMaxTurns: Number(aiDefaults.maxTurns ?? config.defaultMaxTurns ?? DEFAULT_AI_MAX_TURNS),
        defaultMaxBudgetUsd: Number(aiDefaults.maxBudgetUsd ?? config.defaultMaxBudgetUsd ?? DEFAULT_AI_MAX_BUDGET_USD),
        projectRoot,
    });
    const logger = defaultLogger;
    // Late-binding reference for circular dependency between runtime and orchestrator
    let orchestrator;
    const callFn = options.callFn ?? (async () => null);
    // Optional session manager for persistent background sessions
    let sessionManager;
    if (options.enableSessions) {
        sessionManager = new SessionManager({
            projectRoot,
            defaultModel: String(aiDefaults.model ?? config.defaultModel ?? DEFAULT_AI_MODEL),
            defaultMaxTurns: Number(aiDefaults.maxTurns ?? config.defaultMaxTurns ?? DEFAULT_AI_MAX_TURNS),
            defaultMaxBudgetUsd: Number(aiDefaults.maxBudgetUsd ?? config.defaultMaxBudgetUsd ?? DEFAULT_AI_MAX_BUDGET_USD),
            logger,
        });
    }
    const workflowRuntime = new WorkflowRuntime({
        projectRoot,
        aiCaller: aiClient,
        attentionEnhancer,
        memoryStoreGetter: (pid) => memoryFactory.getStore(pid),
        globalMemoryStore: memoryFactory.getGlobalStore(),
        eventBus,
        positionManager,
        emitFn: async (taskType, payload, sourcePositionId, targetPositionId) => {
            const event = eventBus.createEvent(`${TASK_EVENT_PREFIX}${taskType}`, sourcePositionId, payload, targetPositionId);
            await eventBus.emit(event);
        },
        callFn,
        logger,
        sessionManager,
    });
    const concurrency = config.concurrency;
    orchestrator = new Orchestrator(positionManager, workflowRuntime, eventBus, concurrency, sessionManager, sessionManager ? (pid) => memoryFactory.getStore(pid) : undefined);
    return { positionManager, memoryFactory, eventBus, orchestrator, workflowRuntime, sessionManager, config, logger };
}
/**
 * Register graceful shutdown handlers for SIGINT/SIGTERM.
 */
export function onShutdown(orchestrator) {
    const shutdown = async () => {
        console.log('\nShutting down...');
        await orchestrator.stop();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
//# sourceMappingURL=runtime-factory.js.map