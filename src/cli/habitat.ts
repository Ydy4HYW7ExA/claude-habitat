/**
 * startHabitat — main entry when user runs `claude-habitat` with no subcommand.
 *
 * Spawns the dispatcher as an interactive claude CLI session (stdio:inherit),
 * with an MCP bridge connecting back to the habitat runtime for memory,
 * events, and admin tools. Background positions run headless via SDK query().
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { createHabitatRuntime, ensureInitialized, onShutdown } from './runtime-factory.js';
import { SocketServer } from '../mcp/socket-server.js';
import {
  HABITAT_DIR, DISPATCHER_ID, DISPATCHER_ROLE_TEMPLATE,
  MCP_BRIDGE_SOCKET_FILE, MCP_BRIDGE_CONFIG_FILE,
  TOOL_NAME, ADMIN_TOOL_NAME, MEMORY_LAYER,
  truncateSummary, DEFAULT_RECALL_LIMIT, TASK_EVENT_PREFIX, EVENT_TYPE,
  TASK_PRIORITY, TASK_STATUS,
} from '../constants.js';

export async function startHabitat(projectRoot: string): Promise<void> {
  await ensureInitialized(projectRoot);

  const runtime = await createHabitatRuntime(projectRoot, {
    attentionMode: 'full',
    enableSessions: true,
  });

  const { positionManager, memoryFactory, eventBus, orchestrator, logger } = runtime;

  // Find dispatcher position
  const positions = await positionManager.listPositions();
  if (positions.length === 0) {
    console.error('No positions found. Run: claude-habitat bootstrap');
    process.exit(1);
  }

  let dispatcherPosition = positions.find(p => p.id === DISPATCHER_ID);
  if (!dispatcherPosition) {
    dispatcherPosition = positions.find(p => p.roleTemplateName === DISPATCHER_ROLE_TEMPLATE);
  }
  if (!dispatcherPosition) {
    // Fallback: use first position
    dispatcherPosition = positions[0];
    logger('warn', `No dispatcher position found, using ${dispatcherPosition.id}`);
  }

  const dispatcherTemplate = await positionManager.getRoleTemplate(dispatcherPosition.roleTemplateName);

  // ─── Socket Server ─────────────────────────────────────────────
  const habitatDir = path.join(projectRoot, HABITAT_DIR);
  const socketPath = path.join(habitatDir, MCP_BRIDGE_SOCKET_FILE);
  const mcpConfigPath = path.join(habitatDir, MCP_BRIDGE_CONFIG_FILE);

  const dispatcherMemory = memoryFactory.getStore(dispatcherPosition.id);
  const globalMemory = memoryFactory.getGlobalStore();

  // Build socket handlers — map tool names to runtime method calls
  const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
    // Memory tools
    [TOOL_NAME.REMEMBER]: async (args) => {
      const { content, keywords, summary } = args as { content: string; keywords?: string[]; summary?: string };
      const entry = await dispatcherMemory.write({
        layer: MEMORY_LAYER.EPISODE,
        content,
        summary: summary ?? truncateSummary(content),
        keywords: keywords ?? [],
        refs: [],
        metadata: { positionId: dispatcherPosition!.id },
      });
      return { content: [{ type: 'text', text: `Memory saved: ${entry.id}` }] };
    },
    [TOOL_NAME.RECALL]: async (args) => {
      const { query, layer, limit } = args as { query: string; layer?: string; limit?: number };
      const results = await dispatcherMemory.search(query, {
        layer: layer as 'episode' | 'trace' | 'category' | 'insight' | undefined,
        limit: limit ?? DEFAULT_RECALL_LIMIT,
      });
      const formatted = results.map(e => `[${e.id}] (${e.layer}) ${e.summary}\n${e.content}`).join('\n\n---\n\n');
      return { content: [{ type: 'text', text: formatted || 'No memories found.' }] };
    },
    [TOOL_NAME.FORGET]: async (args) => {
      const { id, reason } = args as { id: string; reason: string };
      await dispatcherMemory.delete(id);
      return { content: [{ type: 'text', text: `Memory ${id} deleted. Reason: ${reason}` }] };
    },
    [TOOL_NAME.REWRITE_MEMORY]: async (args) => {
      const { id, newContent, newSummary, newKeywords } = args as { id: string; newContent: string; newSummary?: string; newKeywords?: string[] };
      await dispatcherMemory.rewrite(id, newContent, newSummary ?? truncateSummary(newContent), newKeywords ?? []);
      return { content: [{ type: 'text', text: `Memory ${id} rewritten.` }] };
    },
    [TOOL_NAME.RECALL_GLOBAL]: async (args) => {
      const { query, limit } = args as { query: string; limit?: number };
      const results = await globalMemory.search(query, { limit: limit ?? DEFAULT_RECALL_LIMIT });
      const formatted = results.map(e => `[${e.id}] (${e.layer}) ${e.summary}\n${e.content}`).join('\n\n---\n\n');
      return { content: [{ type: 'text', text: formatted || 'No global memories found.' }] };
    },
    [TOOL_NAME.REMEMBER_GLOBAL]: async (args) => {
      const { content, keywords, summary } = args as { content: string; keywords?: string[]; summary?: string };
      const entry = await globalMemory.write({
        layer: MEMORY_LAYER.EPISODE,
        content,
        summary: summary ?? truncateSummary(content),
        keywords: keywords ?? [],
        refs: [],
        metadata: { positionId: dispatcherPosition!.id },
      });
      return { content: [{ type: 'text', text: `Global memory saved: ${entry.id}` }] };
    },
    // Event tools
    [TOOL_NAME.EMIT_TASK]: async (args) => {
      const { taskType, payload, targetPositionId } = args as { taskType: string; payload: unknown; targetPositionId?: string };
      const event = eventBus.createEvent(
        `${TASK_EVENT_PREFIX}${taskType}`,
        dispatcherPosition!.id,
        payload,
        targetPositionId,
      );
      await eventBus.emit(event);
      return { content: [{ type: 'text', text: `Task emitted: ${event.id}` }] };
    },
    [TOOL_NAME.GET_MY_TASKS]: async () => {
      const pos = await positionManager.getPosition(dispatcherPosition!.id);
      const pending = pos?.taskQueue.filter(t => t.status === TASK_STATUS.PENDING) ?? [];
      return { content: [{ type: 'text', text: JSON.stringify(pending, null, 2) }] };
    },
    [TOOL_NAME.REPORT_STATUS]: async (args) => {
      const { status, progress } = args as { status: string; progress?: number };
      const event = eventBus.createEvent(
        EVENT_TYPE.POSITION_STATUS_REPORT,
        dispatcherPosition!.id,
        { status, progress },
      );
      await eventBus.emit(event);
      return { content: [{ type: 'text', text: 'Status reported.' }] };
    },
    [TOOL_NAME.REQUEST_WORKFLOW_CHANGE]: async (args) => {
      const { description, suggestedCode, reason } = args as { description: string; suggestedCode?: string; reason: string };
      const event = eventBus.createEvent(
        EVENT_TYPE.WORKFLOW_CHANGE_REQUEST,
        dispatcherPosition!.id,
        { description, suggestedCode, reason },
      );
      await eventBus.emit(event);
      return { content: [{ type: 'text', text: 'Workflow change request submitted.' }] };
    },
    // Admin tools (dispatcher is admin)
    [ADMIN_TOOL_NAME.LIST_POSITIONS]: async () => {
      const allPositions = await positionManager.listPositions();
      const summary = allPositions.map(p => `${p.id} (${p.roleTemplateName}) — ${p.status}`).join('\n');
      return { content: [{ type: 'text', text: summary || 'No positions.' }] };
    },
    [ADMIN_TOOL_NAME.DISPATCH_TASK]: async (args) => {
      const { targetPositionId, taskType, payload, priority } = args as {
        targetPositionId: string; taskType: string; payload: unknown; priority?: string;
      };
      const task = await orchestrator.dispatchTask({
        sourcePositionId: dispatcherPosition!.id,
        targetPositionId,
        type: taskType,
        payload,
        priority: (priority ?? TASK_PRIORITY.NORMAL) as 'low' | 'normal' | 'high' | 'critical',
      });
      return { content: [{ type: 'text', text: `Task '${task.id}' dispatched to '${targetPositionId}'.` }] };
    },
    [ADMIN_TOOL_NAME.GET_POSITION_STATUS]: async (args) => {
      const { positionId } = args as { positionId: string };
      const pos = await positionManager.getPosition(positionId);
      if (!pos) return { content: [{ type: 'text', text: `Position '${positionId}' not found.` }] };
      return { content: [{ type: 'text', text: JSON.stringify(pos, null, 2) }] };
    },
  };

  const socketServer = new SocketServer({ socketPath, handlers, logger });
  await socketServer.start();

  // ─── MCP Config File ───────────────────────────────────────────
  const bridgeServerPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../../dist/src/mcp/bridge-server.js',
  );

  // Try to find the bridge server — check both dist and src locations
  let actualBridgePath = bridgeServerPath;
  try {
    await fs.access(bridgeServerPath);
  } catch {
    // Fallback: use tsx to run the TypeScript source directly
    actualBridgePath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      '../mcp/bridge-server.ts',
    );
  }

  const isAdmin = dispatcherTemplate?.isAdmin ?? false;
  const mcpConfig = {
    mcpServers: {
      habitat: {
        command: actualBridgePath.endsWith('.ts') ? 'npx' : 'node',
        args: actualBridgePath.endsWith('.ts')
          ? ['tsx', actualBridgePath]
          : [actualBridgePath],
        env: {
          HABITAT_SOCKET: socketPath,
          HABITAT_IS_ADMIN: String(isAdmin),
        },
      },
    },
  };

  await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));

  // ─── Start Orchestrator ────────────────────────────────────────
  await orchestrator.start();

  // ─── Build dispatcher system prompt ────────────────────────────
  const promptParts: string[] = [];
  if (dispatcherTemplate?.systemPromptAppend) {
    promptParts.push(dispatcherTemplate.systemPromptAppend);
  }

  // Try to load dispatcher workflow prompt
  try {
    const workflowPath = dispatcherPosition.config?.workflowPath ?? dispatcherTemplate?.workflowPath;
    if (workflowPath) {
      const fullPath = path.resolve(projectRoot, workflowPath);
      const code = await fs.readFile(fullPath, 'utf-8');
      // Extract DISPATCHER_PROMPT from the workflow file
      const match = code.match(/export\s+const\s+DISPATCHER_PROMPT\s*=\s*`([\s\S]*?)`;/);
      if (match) {
        promptParts.push(match[1]);
      }
    }
  } catch {
    // Workflow not found, use template prompt only
  }

  const systemPrompt = promptParts.join('\n\n');

  // ─── Shutdown handler ──────────────────────────────────────────
  const cleanup = async () => {
    console.log('\nShutting down habitat...');
    await orchestrator.stop();
    if (runtime.sessionManager) {
      await runtime.sessionManager.stopAll();
    }
    await socketServer.stop();
    try { await fs.unlink(mcpConfigPath); } catch { /* ignore */ }
  };

  process.on('SIGINT', async () => { await cleanup(); process.exit(0); });
  process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });

  // ─── Spawn claude CLI ──────────────────────────────────────────
  const claudeArgs = [
    '--mcp-config', mcpConfigPath,
  ];
  if (systemPrompt) {
    claudeArgs.push('--append-system-prompt', systemPrompt);
  }

  const child = spawn('claude', claudeArgs, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env },
  });

  child.on('error', (err) => {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error('claude CLI not found. Install it first: npm install -g @anthropic-ai/claude-code');
    } else {
      console.error('Failed to start claude:', err.message);
    }
    cleanup().then(() => process.exit(1));
  });

  // Wait for claude to exit
  const exitCode = await new Promise<number>((resolve) => {
    child.on('exit', (code) => resolve(code ?? 0));
  });

  await cleanup();
  process.exit(exitCode);
}
