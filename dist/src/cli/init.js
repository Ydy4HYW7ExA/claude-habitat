import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { HABITAT_DIR, ROLES_DIR, POSITIONS_DIR, MEMORY_DIR, EVENTS_DIR, LOGS_DIR, GLOBAL_MEMORY_ID, CONFIG_FILE, INDEX_FILE, META_FILE, LINKS_FILE, WORKFLOW_DIR, ENTRIES_SUBDIR, DEFAULT_CONCURRENCY_CONFIG, DEFAULT_AI_MODEL, DEFAULT_AI_MAX_TURNS, DEFAULT_AI_MAX_BUDGET_USD, CONFIG_VERSION, BOOTSTRAP_AI_CONFIG, MODEL, } from '../constants.js';
import { createEmptyIndex } from '../memory/index-engine.js';
import { createEmptyMeta } from '../memory/types.js';
import { readBuiltinWorkflow } from './package-utils.js';
const DEFAULT_CONFIG = {
    version: CONFIG_VERSION,
    concurrency: { ...DEFAULT_CONCURRENCY_CONFIG },
    defaultModel: DEFAULT_AI_MODEL,
    defaultMaxTurns: DEFAULT_AI_MAX_TURNS,
    defaultMaxBudgetUsd: DEFAULT_AI_MAX_BUDGET_USD,
};
export async function init(projectRoot) {
    const habitatDir = path.join(projectRoot, HABITAT_DIR);
    // Check if already initialized
    try {
        await fs.access(path.join(habitatDir, CONFIG_FILE));
        console.log(`${HABITAT_DIR} already exists. Skipping init.`);
        return;
    }
    catch {
        // Not initialized yet
    }
    // Create directory structure
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
    // Write config
    await fs.writeFile(path.join(habitatDir, CONFIG_FILE), JSON.stringify(DEFAULT_CONFIG, null, 2));
    // Write global memory index
    await fs.writeFile(path.join(habitatDir, MEMORY_DIR, GLOBAL_MEMORY_ID, INDEX_FILE), JSON.stringify(createEmptyIndex(), null, 2));
    // Write global memory meta
    await fs.writeFile(path.join(habitatDir, MEMORY_DIR, GLOBAL_MEMORY_ID, META_FILE), JSON.stringify(createEmptyMeta(), null, 2));
    // Write cross-store links
    await fs.writeFile(path.join(habitatDir, MEMORY_DIR, LINKS_FILE), '[]');
    // Copy built-in role templates
    await writeBuiltinTemplates(habitatDir);
    // Copy built-in workflow files
    await copyBuiltinWorkflows(habitatDir);
    console.log('Initialized claude-habitat in', habitatDir);
    console.log('');
    console.log('Next steps:');
    console.log('  claude-habitat bootstrap    # Let AI design your team');
    console.log('  claude-habitat status       # Check system status');
}
async function writeBuiltinTemplates(habitatDir) {
    const templates = [
        {
            name: 'org-architect',
            description: '组织架构师 — 负责设计和管理 AI 团队结构、岗位职责、工作流程。具有创建/修改/删除岗位的管理权限。',
            workflowPath: path.join(HABITAT_DIR, WORKFLOW_DIR, 'org-architect.mjs'),
            model: MODEL.OPUS,
            maxTurns: BOOTSTRAP_AI_CONFIG.maxTurns,
            isAdmin: true,
            systemPromptAppend: '你是组织架构师，负责设计和优化 AI 团队。你可以创建岗位、定义工作流、配置协作关系。',
        },
        {
            name: 'coder',
            description: '高级软件工程师 — 负责编写高质量代码，遵循 TDD 开发流程。',
            workflowPath: path.join(HABITAT_DIR, WORKFLOW_DIR, 'coder.mjs'),
            model: MODEL.SONNET,
            maxTurns: DEFAULT_AI_MAX_TURNS,
            systemPromptAppend: '你是一名高级软件工程师。遵循 TDD：先写测试，再写实现。所有代码必须通过 lint 和类型检查。',
        },
        {
            name: 'reviewer',
            description: '代码审查员 — 负责审查代码质量、安全性、性能，提供改进建议。',
            workflowPath: path.join(HABITAT_DIR, WORKFLOW_DIR, 'reviewer.mjs'),
            model: MODEL.SONNET,
            maxTurns: DEFAULT_AI_MAX_TURNS,
            systemPromptAppend: '你是代码审查员。关注代码质量、安全漏洞、性能问题、可维护性。给出具体的改进建议。',
        },
        {
            name: 'memory-curator',
            description: '记忆管理员（可选）— 负责整合、优化记忆库，提炼高阶洞察。类似 DBA 之于数据库。',
            workflowPath: path.join(HABITAT_DIR, WORKFLOW_DIR, 'memory-curator.mjs'),
            model: MODEL.HAIKU,
            maxTurns: DEFAULT_AI_MAX_TURNS,
            systemPromptAppend: '你是记忆管理员。定期整合记忆条目，提炼高阶洞察，清理过时信息。',
        },
        {
            name: 'dispatcher',
            description: '对接员 — 与用户直接交互，协调 AI 团队完成任务。',
            workflowPath: path.join(HABITAT_DIR, WORKFLOW_DIR, 'dispatcher.mjs'),
            model: MODEL.OPUS,
            maxTurns: 100,
            isAdmin: true,
            systemPromptAppend: '你是对接员，负责与用户交互并协调团队。',
        },
    ];
    for (const template of templates) {
        await fs.writeFile(path.join(habitatDir, ROLES_DIR, `${template.name}.json`), JSON.stringify(template, null, 2));
    }
}
async function copyBuiltinWorkflows(habitatDir) {
    const workflowDir = path.join(habitatDir, WORKFLOW_DIR);
    await fs.mkdir(workflowDir, { recursive: true });
    const names = ['org-architect', 'coder', 'reviewer', 'memory-curator', 'dispatcher'];
    for (const name of names) {
        const destPath = path.join(workflowDir, `${name}.mjs`);
        try {
            await fs.access(destPath);
            continue; // already exists, skip
        }
        catch { /* doesn't exist, copy it */ }
        try {
            const code = await readBuiltinWorkflow(name);
            await fs.writeFile(destPath, code);
        }
        catch {
            // built-in workflow not found, skip
        }
    }
}
//# sourceMappingURL=init.js.map