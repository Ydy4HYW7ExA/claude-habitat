#!/usr/bin/env npx tsx
/**
 * Claude Habitat 端到端仿真测试
 *
 * 文档处理流水线：intake → reviewer → archiver
 * 验证：任务分发、事件路由、记忆存储、跨岗位协作
 *
 * Usage: npx tsx scripts/simulate.ts
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { PositionManager } from '../src/position/manager.js';
import { EventBus } from '../src/orchestration/event-bus.js';
import { Orchestrator } from '../src/orchestration/orchestrator.js';
import { FileMemoryStoreFactory } from '../src/memory/factory.js';
import { MockWorkflowRuntime } from './lib/mock-runtime.js';
import { EventViewer } from './lib/event-viewer.js';
import {
  HABITAT_DIR, ROLES_DIR, WORKFLOW_DIR, POSITIONS_DIR,
  MEMORY_DIR, EVENTS_DIR, LOGS_DIR, GLOBAL_MEMORY_ID,
  ENTRIES_SUBDIR, CONFIG_FILE, INDEX_FILE, META_FILE, LINKS_FILE,
  DEFAULT_CONCURRENCY_CONFIG, CONFIG_VERSION,
  TASK_STATUS,
} from '../src/constants.js';
import { createEmptyIndex } from '../src/memory/index-engine.js';
import { createEmptyMeta } from '../src/memory/types.js';
import type { RoleTemplate } from '../src/position/types.js';

// ─── ANSI helpers ────────────────────────────────────────────────────
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function heading(text: string) {
  console.log(`\n${BOLD}${CYAN}═══ ${text} ═══${RESET}\n`);
}

function success(text: string) {
  console.log(`${GREEN}✓${RESET} ${text}`);
}

function fail(text: string) {
  console.error(`${RED}✗${RESET} ${text}`);
}

// ─── Step 1: Create temp habitat directory ───────────────────────────
async function createTempHabitat(): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'habitat-sim-'));
  const habitatDir = path.join(tmpDir, HABITAT_DIR);

  const dirs = [
    habitatDir,
    path.join(habitatDir, ROLES_DIR),
    path.join(habitatDir, WORKFLOW_DIR),
    path.join(habitatDir, POSITIONS_DIR),
    path.join(habitatDir, MEMORY_DIR, GLOBAL_MEMORY_ID, ENTRIES_SUBDIR),
    path.join(habitatDir, EVENTS_DIR),
    path.join(habitatDir, LOGS_DIR),
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Config
  await fs.writeFile(
    path.join(habitatDir, CONFIG_FILE),
    JSON.stringify({ version: CONFIG_VERSION, concurrency: { ...DEFAULT_CONCURRENCY_CONFIG } }, null, 2),
  );

  // Global memory bootstrap files
  await fs.writeFile(
    path.join(habitatDir, MEMORY_DIR, GLOBAL_MEMORY_ID, INDEX_FILE),
    JSON.stringify(createEmptyIndex(), null, 2),
  );
  await fs.writeFile(
    path.join(habitatDir, MEMORY_DIR, GLOBAL_MEMORY_ID, META_FILE),
    JSON.stringify(createEmptyMeta(), null, 2),
  );
  await fs.writeFile(
    path.join(habitatDir, MEMORY_DIR, LINKS_FILE),
    '[]',
  );

  return tmpDir;
}

// ─── Step 2: Register role templates ─────────────────────────────────
async function registerRoles(pm: PositionManager, projectRoot: string): Promise<void> {
  const templates: RoleTemplate[] = [
    {
      name: 'intake-clerk',
      description: '文档接收员 — 接收文档，提取元数据，转发给审核员',
      workflowPath: path.join(HABITAT_DIR, WORKFLOW_DIR, 'intake.mjs'),
    },
    {
      name: 'reviewer',
      description: '文档审核员 — 校验元数据，记录审核结果，转发给归档员',
      workflowPath: path.join(HABITAT_DIR, WORKFLOW_DIR, 'reviewer.mjs'),
    },
    {
      name: 'archiver',
      description: '文档归档员 — 归档到本地记忆和全局记忆',
      workflowPath: path.join(HABITAT_DIR, WORKFLOW_DIR, 'archiver.mjs'),
    },
  ];

  for (const t of templates) {
    await pm.registerRoleTemplate(t);
  }
}

// ─── Step 3: Write workflow .mjs files ───────────────────────────────
async function writeWorkflows(projectRoot: string): Promise<void> {
  const workflowDir = path.join(projectRoot, HABITAT_DIR, WORKFLOW_DIR);

  await fs.writeFile(path.join(workflowDir, 'intake.mjs'), `
export default async function intake(ctx) {
  const doc = ctx.args;
  ctx.log('info', '[intake] 处理文档: ' + doc.title);

  const metadata = {
    title: doc.title,
    author: doc.author,
    wordCount: (doc.content || '').split(/\\s+/).length,
    receivedAt: Date.now(),
  };

  await ctx.memory.remember(
    '处理文档 "' + metadata.title + '"，' + metadata.wordCount + ' 字',
    ['intake', 'document'],
  );

  await ctx.emit('review-document', { originalDoc: doc, metadata }, 'reviewer');
}
`.trimStart());

  await fs.writeFile(path.join(workflowDir, 'reviewer.mjs'), `
export default async function reviewer(ctx) {
  const { originalDoc, metadata } = ctx.args;
  ctx.log('info', '[reviewer] 审核文档: ' + metadata.title);

  const issues = [];
  if (!metadata.title || metadata.title === 'Untitled') issues.push('缺少标题');
  if (metadata.wordCount < 10) issues.push('内容过短');

  const approved = issues.length === 0;

  await ctx.memory.remember(
    '审核 "' + metadata.title + '": ' + (approved ? '通过' : '驳回'),
    ['review', approved ? 'approved' : 'rejected'],
  );

  await ctx.emit('archive-document', {
    originalDoc,
    metadata,
    review: { approved, issues, reviewedAt: Date.now() },
  }, 'archiver');
}
`.trimStart());

  await fs.writeFile(path.join(workflowDir, 'archiver.mjs'), `
export default async function archiver(ctx) {
  const { metadata, review } = ctx.args;
  ctx.log('info', '[archiver] 归档文档: ' + metadata.title);

  await ctx.memory.remember(
    '归档 "' + metadata.title + '" (审核: ' + (review.approved ? '通过' : '驳回') + ')',
    ['archive'],
  );

  await ctx.memory.rememberGlobal(
    '文档 "' + metadata.title + '" 已处理归档。审核: ' + (review.approved ? '通过' : '驳回') + '，字数: ' + metadata.wordCount,
    ['document', 'archive'],
  );
}
`.trimStart());
}

// ─── Step 7: Wait for pipeline completion ────────────────────────────
async function waitForCompletion(
  pm: PositionManager,
  timeoutMs: number = 15_000,
): Promise<boolean> {
  const start = Date.now();
  const pollInterval = 200;

  while (Date.now() - start < timeoutMs) {
    const archiver = await pm.getPosition('archiver');
    if (archiver) {
      const done = archiver.taskQueue.some(t => t.status === TASK_STATUS.DONE);
      if (done) return true;
    }
    await new Promise(r => setTimeout(r, pollInterval));
  }
  return false;
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  heading('Claude Habitat 端到端仿真');
  console.log('场景: 文档处理流水线 (intake → reviewer → archiver)\n');

  // Step 1: Temp habitat
  const projectRoot = await createTempHabitat();
  success(`临时目录: ${projectRoot}`);

  const habitatDir = path.join(projectRoot, HABITAT_DIR);

  try {
    // Step 2: Assemble runtime components
    const logger = (level: string, msg: string) => {
      console.log(`${DIM}[${level}]${RESET} ${msg}`);
    };

    const pm = new PositionManager(habitatDir);
    const eventBus = new EventBus(habitatDir, logger as any);
    const memoryFactory = new FileMemoryStoreFactory(path.join(habitatDir, MEMORY_DIR));
    const globalMemoryStore = memoryFactory.getGlobalStore();

    // Register roles
    await registerRoles(pm, projectRoot);
    success('注册 3 个角色模板');

    // Write workflows
    await writeWorkflows(projectRoot);
    success('写入 3 个工作流文件 (.mjs)');

    // Step 4: MockWorkflowRuntime
    const mockRuntime = new MockWorkflowRuntime({
      projectRoot,
      eventBus,
      memoryStoreGetter: (positionId: string) => memoryFactory.getStore(positionId),
      globalMemoryStore,
      logger: logger as any,
    });

    // Step 5: Orchestrator (accepts MockWorkflowRuntime via structural typing)
    const orchestrator = new Orchestrator(
      pm,
      mockRuntime as any,
      eventBus,
      { ...DEFAULT_CONCURRENCY_CONFIG, maxConcurrentPositions: 3, maxConcurrentAiCalls: 2, positionTimeout: 15_000 },
    );

    // Create positions
    await orchestrator.createPosition('intake-clerk', { positionId: 'intake' });
    await orchestrator.createPosition('reviewer', { positionId: 'reviewer' });
    await orchestrator.createPosition('archiver', { positionId: 'archiver' });
    success('创建 3 个岗位: intake, reviewer, archiver');

    // Start orchestrator + event viewer
    const eventViewer = new EventViewer(eventBus);
    eventViewer.start();
    await orchestrator.start();
    success('Orchestrator 已启动');

    heading('实时事件流');

    // Step 6: Dispatch initial task
    await orchestrator.dispatchTask({
      sourcePositionId: 'cli',
      targetPositionId: 'intake',
      type: 'process-document',
      payload: {
        title: 'Claude Habitat 设计文档',
        author: 'Team',
        content: '这是一份关于 Claude Habitat AI 认知操作系统的设计文档，描述了多智能体编排系统的架构设计、核心概念和实现方案。系统基于 Claude Code SDK 构建，支持岗位管理、工作流执行、事件路由和分层记忆。',
      },
      priority: 'normal',
    });

    // Step 7: Wait for pipeline
    const completed = await waitForCompletion(pm);

    // Give a moment for final events to settle
    await new Promise(r => setTimeout(r, 500));

    // Stop
    eventViewer.stop();
    await orchestrator.stop();

    // ─── Step 8: Output results ──────────────────────────────────────
    heading('仿真结果');

    if (completed) {
      success('流水线完成');
    } else {
      fail('流水线超时');
    }

    // Orchestrator status
    const status = await orchestrator.getStatus();
    console.log(`\n${BOLD}Orchestrator 状态:${RESET}`);
    console.log(`  running: ${status.running}`);
    console.log(`  positions: ${status.positions.map(p => `${p.id}(${p.status})`).join(', ')}`);
    console.log(`  completedTasks: ${status.completedTasks}`);
    console.log(`  pendingTasks: ${status.pendingTasks}`);
    console.log(`  totalCostUsd: $${status.totalCostUsd.toFixed(4)}`);

    // Memory contents
    console.log(`\n${BOLD}岗位本地记忆:${RESET}`);
    for (const posId of ['intake', 'reviewer', 'archiver']) {
      const store = memoryFactory.getStore(posId);
      const entries = await store.listByLayer('episode');
      console.log(`  ${posId}: ${entries.length} 条`);
      for (const e of entries) {
        console.log(`    - ${e.content}`);
      }
    }

    console.log(`\n${BOLD}全局记忆:${RESET}`);
    const globalEntries = await globalMemoryStore.listByLayer('episode');
    console.log(`  ${globalEntries.length} 条`);
    for (const e of globalEntries) {
      console.log(`    - ${e.content}`);
    }

    // Event summary
    const collected = eventViewer.getCollected();
    const created = collected.filter(e => e.type === 'task.created').length;
    const completedEvents = collected.filter(e => e.type === 'task.completed').length;
    const failed = collected.filter(e => e.type === 'task.failed').length;

    console.log(`\n${BOLD}事件统计:${RESET}`);
    console.log(`  task.created:   ${created}`);
    console.log(`  task.completed: ${completedEvents}`);
    console.log(`  task.failed:    ${failed}`);
    console.log(`  总事件数:       ${collected.length}`);

    // Replay from JSONL
    const eventsDir = path.join(habitatDir, EVENTS_DIR);
    try {
      const files = await fs.readdir(eventsDir);
      const jsonlFile = files.find(f => f.endsWith('.jsonl'));
      if (jsonlFile) {
        await eventViewer.replay(path.join(eventsDir, jsonlFile));
      }
    } catch {
      // No events file
    }

    // Final verdict
    heading('验证');
    let allPassed = true;

    const check = (label: string, ok: boolean) => {
      if (ok) success(label);
      else { fail(label); allPassed = false; }
    };

    check('流水线完成 (archiver 有 done 任务)', completed);
    check('3 个 task.created 事件', created === 3);
    check('3 个 task.completed 事件', completedEvents === 3);
    check('0 个 task.failed 事件', failed === 0);
    check('intake 本地记忆 1 条', (await memoryFactory.getStore('intake').listByLayer('episode')).length === 1);
    check('reviewer 本地记忆 1 条', (await memoryFactory.getStore('reviewer').listByLayer('episode')).length === 1);
    check('archiver 本地记忆 1 条', (await memoryFactory.getStore('archiver').listByLayer('episode')).length === 1);
    check('全局记忆 1 条 (archiver 写入)', globalEntries.length === 1);

    if (allPassed) {
      console.log(`\n${GREEN}${BOLD}全部验证通过!${RESET}\n`);
    } else {
      console.log(`\n${RED}${BOLD}部分验证失败${RESET}\n`);
      process.exitCode = 1;
    }
  } finally {
    // Cleanup
    await fs.rm(projectRoot, { recursive: true, force: true });
    console.log(`${DIM}已清理临时目录${RESET}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
