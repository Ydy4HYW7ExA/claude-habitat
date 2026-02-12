import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { HABITAT_DIR, PROGRAM_DIR, PROGRAM_SDK_DIR, PROGRAM_APP_DIR, DATA_DIR, SHARED_DATA_ID, PROCESS_DIR, MANIFEST_FILE, CONFIG_FILE, INDEX_FILE, META_FILE, LINKS_FILE, ENTRIES_SUBDIR, DEFAULT_CONCURRENCY_CONFIG, DEFAULT_AI_MODEL, DEFAULT_AI_MAX_TURNS, DEFAULT_AI_MAX_BUDGET_USD, CONFIG_VERSION, BOOTSTRAP_AI_CONFIG, MODEL, } from '../constants.js';
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
        path.join(habitatDir, PROGRAM_DIR, PROGRAM_SDK_DIR),
        path.join(habitatDir, PROGRAM_DIR, PROGRAM_APP_DIR),
        path.join(habitatDir, DATA_DIR, SHARED_DATA_ID, 'memory', ENTRIES_SUBDIR),
        path.join(habitatDir, DATA_DIR, SHARED_DATA_ID, 'events'),
        path.join(habitatDir, DATA_DIR, SHARED_DATA_ID, 'logs'),
        path.join(habitatDir, PROCESS_DIR),
    ];
    for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
    }
    // Write config
    await fs.writeFile(path.join(habitatDir, CONFIG_FILE), JSON.stringify(DEFAULT_CONFIG, null, 2));
    // Write global memory index
    await fs.writeFile(path.join(habitatDir, DATA_DIR, SHARED_DATA_ID, 'memory', INDEX_FILE), JSON.stringify(createEmptyIndex(), null, 2));
    // Write global memory meta
    await fs.writeFile(path.join(habitatDir, DATA_DIR, SHARED_DATA_ID, 'memory', META_FILE), JSON.stringify(createEmptyMeta(), null, 2));
    // Write cross-store links
    await fs.writeFile(path.join(habitatDir, DATA_DIR, SHARED_DATA_ID, LINKS_FILE), '[]');
    // Write SDK declarations
    await writeSdkDeclarations(habitatDir);
    // Copy built-in programs (role templates + workflows)
    await writeBuiltinPrograms(habitatDir);
    console.log('Initialized claude-habitat in', habitatDir);
    console.log('');
    console.log('Next steps:');
    console.log('  claude-habitat bootstrap    # Let AI design your team');
    console.log('  claude-habitat status       # Check system status');
}
async function writeSdkDeclarations(habitatDir) {
    const sdkDir = path.join(habitatDir, PROGRAM_DIR, PROGRAM_SDK_DIR);
    const memoryDecl = {
        name: 'memory',
        version: CONFIG_VERSION,
        description: '持久化记忆系统 — 每个进程拥有私有记忆空间，另有全局共享记忆。',
        capabilities: {
            layers: ['episode', 'trace', 'category', 'insight'],
            operations: ['write', 'search', 'delete', 'rewrite', 'consolidate'],
            storage: 'file-system',
            indexing: 'tf-idf',
        },
        dataLayout: {
            perProcess: 'data/{process-id}/memory/',
            shared: 'data/_shared/memory/',
        },
    };
    const eventsDecl = {
        name: 'events',
        version: CONFIG_VERSION,
        description: '事件总线 — 进程间异步通信，支持任务派发、状态报告、工作流变更请求。',
        capabilities: {
            patterns: ['publish-subscribe', 'wildcard-matching'],
            persistence: 'jsonl-append',
            eventTypes: [
                'task.created', 'task.completed', 'task.failed',
                'position.status_report', 'workflow.change_request',
            ],
        },
        dataLayout: {
            events: 'data/_shared/events/',
            logs: 'data/_shared/logs/',
        },
    };
    await fs.writeFile(path.join(sdkDir, 'memory.json'), JSON.stringify(memoryDecl, null, 2));
    await fs.writeFile(path.join(sdkDir, 'events.json'), JSON.stringify(eventsDecl, null, 2));
}
async function writeBuiltinPrograms(habitatDir) {
    const programs = [
        {
            name: 'org-architect',
            description: '组织架构师 — 负责设计和管理 AI 团队结构、岗位职责、工作流程。具有创建/修改/删除岗位的管理权限。',
            workflowPath: path.join(HABITAT_DIR, PROGRAM_DIR, PROGRAM_APP_DIR, 'org-architect', 'workflow.mjs'),
            model: MODEL.OPUS,
            maxTurns: BOOTSTRAP_AI_CONFIG.maxTurns,
            isAdmin: true,
            systemPromptAppend: '你是组织架构师，负责设计和优化 AI 团队。你可以创建岗位、定义工作流、配置协作关系。',
        },
        {
            name: 'coder',
            description: '高级软件工程师 — 负责编写高质量代码，遵循 TDD 开发流程。',
            workflowPath: path.join(HABITAT_DIR, PROGRAM_DIR, PROGRAM_APP_DIR, 'coder', 'workflow.mjs'),
            model: MODEL.SONNET,
            maxTurns: DEFAULT_AI_MAX_TURNS,
            systemPromptAppend: '你是一名高级软件工程师。遵循 TDD：先写测试，再写实现。所有代码必须通过 lint 和类型检查。',
        },
        {
            name: 'reviewer',
            description: '代码审查员 — 负责审查代码质量、安全性、性能，提供改进建议。',
            workflowPath: path.join(HABITAT_DIR, PROGRAM_DIR, PROGRAM_APP_DIR, 'reviewer', 'workflow.mjs'),
            model: MODEL.SONNET,
            maxTurns: DEFAULT_AI_MAX_TURNS,
            systemPromptAppend: '你是代码审查员。关注代码质量、安全漏洞、性能问题、可维护性。给出具体的改进建议。',
        },
        {
            name: 'memory-curator',
            description: '记忆管理员（可选）— 负责整合、优化记忆库，提炼高阶洞察。类似 DBA 之于数据库。',
            workflowPath: path.join(HABITAT_DIR, PROGRAM_DIR, PROGRAM_APP_DIR, 'memory-curator', 'workflow.mjs'),
            model: MODEL.HAIKU,
            maxTurns: DEFAULT_AI_MAX_TURNS,
            systemPromptAppend: '你是记忆管理员。定期整合记忆条目，提炼高阶洞察，清理过时信息。',
        },
        {
            name: 'dispatcher',
            description: '对接员 — 与用户直接交互，协调 AI 团队完成任务。',
            workflowPath: path.join(HABITAT_DIR, PROGRAM_DIR, PROGRAM_APP_DIR, 'dispatcher', 'workflow.mjs'),
            model: MODEL.OPUS,
            maxTurns: 100,
            isAdmin: true,
            systemPromptAppend: '你是对接员，负责与用户交互并协调团队。',
        },
    ];
    for (const program of programs) {
        const programDir = path.join(habitatDir, PROGRAM_DIR, PROGRAM_APP_DIR, program.name);
        await fs.mkdir(programDir, { recursive: true });
        // Write manifest.json
        await fs.writeFile(path.join(programDir, MANIFEST_FILE), JSON.stringify(program, null, 2));
        // Copy workflow file
        try {
            const code = await readBuiltinWorkflow(program.name);
            await fs.writeFile(path.join(programDir, 'workflow.mjs'), code);
        }
        catch {
            // built-in workflow not found, skip
        }
    }
}
//# sourceMappingURL=init.js.map