import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { init } from './init.js';
import { createHabitatRuntime, onShutdown } from './runtime-factory.js';
import {
  HABITAT_DIR, PROGRAM_DIR, PROGRAM_APP_DIR, ORG_ARCHITECT_ID, CONFIG_FILE,
  DEFAULT_BOOTSTRAP_POLL_INTERVAL_MS, DEFAULT_BOOTSTRAP_TIMEOUT_MS,
  BOOTSTRAP_AI_CONFIG, CLI_SOURCE_ID, BOOTSTRAP_TASK_TYPE,
  TASK_STATUS, TASK_PRIORITY, MODEL, DISPATCHER_ID, DISPATCHER_ROLE_TEMPLATE,
} from '../constants.js';
import { readBuiltinWorkflow } from './package-utils.js';

export async function bootstrap(projectRoot: string): Promise<void> {
  const habitatDir = path.join(projectRoot, HABITAT_DIR);

  // Ensure initialized
  try {
    await fs.access(path.join(habitatDir, CONFIG_FILE));
  } catch {
    console.log('Initializing project first...');
    await init(projectRoot);
  }

  // Copy the built-in org-architect workflow if it doesn't exist
  const bootstrapWorkflowPath = path.join(projectRoot, HABITAT_DIR, PROGRAM_DIR, PROGRAM_APP_DIR, 'org-architect', 'workflow.mjs');
  try {
    await fs.access(bootstrapWorkflowPath);
  } catch {
    await fs.mkdir(path.dirname(bootstrapWorkflowPath), { recursive: true });
    try {
      const builtinCode = await readBuiltinWorkflow('org-architect');
      await fs.writeFile(bootstrapWorkflowPath, builtinCode);
    } catch {
      // Fallback: write a minimal bootstrap workflow
      await fs.writeFile(bootstrapWorkflowPath, FALLBACK_BOOTSTRAP_WORKFLOW);
    }
  }

  const { positionManager, orchestrator } = await createHabitatRuntime(projectRoot, {
    // Bootstrap uses opus with higher limits
    aiDefaults: { ...BOOTSTRAP_AI_CONFIG },
    // Minimal attention: no workflow-injection or history-construction
    // because org-architect has no prior history and its workflow
    // is already provided in the prompt context.
    attentionMode: 'minimal',
  });

  // Create org-architect position
  const template = await positionManager.getProgram(ORG_ARCHITECT_ID);
  if (!template) {
    console.error('org-architect template not found. Re-run: claude-habitat init');
    process.exit(1);
  }

  let architect = await positionManager.getProcess(ORG_ARCHITECT_ID);
  if (!architect) {
    architect = await positionManager.createProcess(ORG_ARCHITECT_ID, ORG_ARCHITECT_ID);
    console.log('Created org-architect position.');
  }

  // Create dispatcher position (if not already present)
  let dispatcher = await positionManager.getProcess(DISPATCHER_ID);
  if (!dispatcher) {
    const dispatcherTemplate = await positionManager.getProgram(DISPATCHER_ROLE_TEMPLATE);
    if (dispatcherTemplate) {
      dispatcher = await positionManager.createProcess(DISPATCHER_ROLE_TEMPLATE, DISPATCHER_ID);
      console.log('Created dispatcher position.');
    }
  }

  onShutdown(orchestrator);
  await orchestrator.start();

  console.log('Starting bootstrap — org-architect will analyze your project and design the AI team...');
  console.log('');

  await orchestrator.dispatchTask({
    sourcePositionId: CLI_SOURCE_ID,
    targetPositionId: ORG_ARCHITECT_ID,
    type: BOOTSTRAP_TASK_TYPE,
    payload: { projectRoot },
    priority: TASK_PRIORITY.CRITICAL,
  });

  // Wait for completion
  const startTime = Date.now();

  while (Date.now() - startTime < DEFAULT_BOOTSTRAP_TIMEOUT_MS) {
    const pos = await positionManager.getProcess(ORG_ARCHITECT_ID);
    if (!pos) break;

    const bootstrapTask = pos.taskQueue.find(t => t.type === BOOTSTRAP_TASK_TYPE);
    if (bootstrapTask && (bootstrapTask.status === TASK_STATUS.DONE || bootstrapTask.status === TASK_STATUS.FAILED)) {
      if (bootstrapTask.status === TASK_STATUS.DONE) {
        console.log('');
        console.log('Bootstrap complete! Your AI team is ready.');
        console.log('Run "claude-habitat status" to see the team.');
      } else {
        console.error('Bootstrap failed:', bootstrapTask.result);
      }
      break;
    }

    await new Promise(r => setTimeout(r, DEFAULT_BOOTSTRAP_POLL_INTERVAL_MS));
  }

  await orchestrator.stop();
}

// Minimal fallback workflow — only used if built-in file can't be found.
// Uses relative path from .claude-habitat/workflows/ to src/ (valid when
// claude-habitat is the project itself; for external projects the built-in
// file copy path above should succeed).
const FALLBACK_BOOTSTRAP_WORKFLOW = `import type { WorkflowContext } from '../../src/workflow/types.js';

export default async function orgArchitect(ctx: WorkflowContext) {
  const { ai, memory, task } = ctx;

  if (task.type === 'bootstrap') {
    const result = await ai(
      '分析当前项目的代码库、技术栈、开发流程。\\n' +
      '然后使用你的管理工具（create_role_template, create_position）创建合适的 AI 团队。\\n' +
      '至少创建以下岗位：\\n' +
      '1. coder — 负责编写代码\\n' +
      '2. reviewer — 负责代码审查\\n' +
      '\\n' +
      '为每个岗位配置合适的工作流和协作关系。',
      { model: '${MODEL.OPUS}', maxTurns: ${BOOTSTRAP_AI_CONFIG.maxTurns} }
    );

    await memory.remember(
      'Bootstrap completed: ' + result.text.slice(0, 200),
      ['bootstrap', 'team-design']
    );
  }
}
`;
