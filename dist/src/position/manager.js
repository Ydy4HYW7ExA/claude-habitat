import { FilePositionStore, FileRoleTemplateStore } from './store.js';
import { nanoid } from 'nanoid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { POSITIONS_DIR, MEMORY_DIR, RULES_SUBDIR, SKILLS_SUBDIR, SESSIONS_SUBDIR, HISTORY_FILE, CLAUDE_MD_FILE, NANOID_LENGTH_POSITION, NANOID_LENGTH_TASK, POSITION_STATUS, TASK_STATUS, PRIORITY_ORDER, ID_PREFIX, PROMPT, } from '../constants.js';
export class PositionManager {
    baseDir;
    positionStore;
    roleTemplateStore;
    constructor(baseDir) {
        this.baseDir = baseDir;
        this.positionStore = new FilePositionStore(baseDir);
        this.roleTemplateStore = new FileRoleTemplateStore(baseDir);
    }
    // --- Role Template Management ---
    async registerRoleTemplate(template) {
        await this.roleTemplateStore.save(template);
    }
    async getRoleTemplate(name) {
        return this.roleTemplateStore.load(name);
    }
    async listRoleTemplates() {
        return this.roleTemplateStore.loadAll();
    }
    async deleteRoleTemplate(name) {
        await this.roleTemplateStore.delete(name);
    }
    // --- Position Management ---
    async createPosition(roleTemplateName, positionId, configOverrides) {
        const template = await this.roleTemplateStore.load(roleTemplateName);
        if (!template) {
            throw new Error(`Role template not found: ${roleTemplateName}`);
        }
        const id = positionId ?? `${roleTemplateName}-${nanoid(NANOID_LENGTH_POSITION)}`;
        const workDir = path.join(this.baseDir, POSITIONS_DIR, id);
        const memoryDir = path.join(this.baseDir, MEMORY_DIR, id);
        const position = {
            id,
            roleTemplateName,
            status: POSITION_STATUS.IDLE,
            sessionHistory: [],
            taskQueue: [],
            outputRoutes: [],
            config: configOverrides,
            workDir,
            memoryDir,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        // Create position directory structure
        await fs.mkdir(workDir, { recursive: true });
        await fs.mkdir(path.join(workDir, RULES_SUBDIR), { recursive: true });
        await fs.mkdir(path.join(workDir, SKILLS_SUBDIR), { recursive: true });
        await fs.mkdir(path.join(workDir, SESSIONS_SUBDIR), { recursive: true });
        await fs.mkdir(memoryDir, { recursive: true });
        // Generate CLAUDE.md from template
        await this.generateClaudeMd(position, template);
        // Generate rules if defined
        if (template.rules) {
            for (const rule of template.rules) {
                const rulePath = path.join(workDir, RULES_SUBDIR, `${rule.name}.md`);
                const frontmatter = rule.paths.length > 0
                    ? `---\npaths:\n${rule.paths.map(p => `  - ${p}`).join('\n')}\n---\n\n`
                    : '';
                await fs.writeFile(rulePath, frontmatter + rule.content);
            }
        }
        // Initialize session history
        await fs.writeFile(path.join(workDir, SESSIONS_SUBDIR, HISTORY_FILE), JSON.stringify({ sessions: [] }, null, 2));
        // Persist
        await this.positionStore.save(position);
        return position;
    }
    async getPosition(id) {
        return this.positionStore.load(id);
    }
    async listPositions() {
        return this.positionStore.loadAll();
    }
    async updatePosition(id, patch) {
        const pos = await this.getPosition(id);
        if (!pos)
            throw new Error(`Position not found: ${id}`);
        const updated = {
            ...pos,
            ...patch,
            id: pos.id, // prevent id change
            updatedAt: Date.now(),
        };
        await this.positionStore.save(updated);
        return updated;
    }
    async setStatus(id, status) {
        await this.updatePosition(id, { status });
    }
    async destroyPosition(id) {
        await this.positionStore.delete(id);
    }
    // --- Task Management ---
    async enqueueTask(positionId, task) {
        const pos = await this.getPosition(positionId);
        if (!pos)
            throw new Error(`Position not found: ${positionId}`);
        const fullTask = {
            ...task,
            id: `${ID_PREFIX.TASK}${nanoid(NANOID_LENGTH_TASK)}`,
            status: TASK_STATUS.PENDING,
            createdAt: Date.now(),
        };
        pos.taskQueue.push(fullTask);
        await this.positionStore.save(pos);
        return fullTask;
    }
    async dequeueTask(positionId) {
        const pos = await this.getPosition(positionId);
        if (!pos)
            return null;
        // Sort by priority, then by creation time
        const pending = pos.taskQueue
            .filter(t => t.status === TASK_STATUS.PENDING)
            .sort((a, b) => {
            const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
            return pd !== 0 ? pd : a.createdAt - b.createdAt;
        });
        if (pending.length === 0)
            return null;
        const task = pending[0];
        task.status = TASK_STATUS.RUNNING;
        pos.currentTask = task;
        await this.positionStore.save(pos);
        return task;
    }
    async completeTask(positionId, taskId, result) {
        const pos = await this.getPosition(positionId);
        if (!pos)
            throw new Error(`Position not found: ${positionId}`);
        const task = pos.taskQueue.find(t => t.id === taskId);
        if (!task)
            throw new Error(`Task not found: ${taskId}`);
        task.status = TASK_STATUS.DONE;
        task.result = result;
        task.completedAt = Date.now();
        if (pos.currentTask?.id === taskId) {
            pos.currentTask = undefined;
        }
        await this.positionStore.save(pos);
    }
    async failTask(positionId, taskId, error) {
        const pos = await this.getPosition(positionId);
        if (!pos)
            throw new Error(`Position not found: ${positionId}`);
        const task = pos.taskQueue.find(t => t.id === taskId);
        if (!task)
            throw new Error(`Task not found: ${taskId}`);
        task.status = TASK_STATUS.FAILED;
        task.result = error;
        task.completedAt = Date.now();
        if (pos.currentTask?.id === taskId) {
            pos.currentTask = undefined;
        }
        await this.positionStore.save(pos);
    }
    // --- Output Routes ---
    async addOutputRoute(positionId, route) {
        const pos = await this.getPosition(positionId);
        if (!pos)
            throw new Error(`Position not found: ${positionId}`);
        pos.outputRoutes.push(route);
        await this.positionStore.save(pos);
    }
    // --- Helpers ---
    async generateClaudeMd(position, template) {
        const lines = [
            PROMPT.CLAUDE_MD_TITLE(position.id),
            '',
            PROMPT.CLAUDE_MD_ROLE(template.name),
            '',
            template.description,
            '',
        ];
        if (template.systemPromptAppend) {
            lines.push(PROMPT.SUPPLEMENTARY_HEADER, '', template.systemPromptAppend, '');
        }
        lines.push(PROMPT.CLAUDE_MD_MEMORY_HEADER, '', ...PROMPT.CLAUDE_MD_MEMORY_INSTRUCTIONS, '');
        await fs.writeFile(path.join(position.workDir, CLAUDE_MD_FILE), lines.join('\n'));
    }
}
//# sourceMappingURL=manager.js.map