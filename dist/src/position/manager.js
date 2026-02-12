import { FileProcessStore, FileProgramStore } from './store.js';
import { nanoid } from 'nanoid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PROCESS_DIR, DATA_DIR, RULES_SUBDIR, SKILLS_SUBDIR, SESSIONS_SUBDIR, HISTORY_FILE, CLAUDE_MD_FILE, NANOID_LENGTH_POSITION, NANOID_LENGTH_TASK, POSITION_STATUS, TASK_STATUS, PRIORITY_ORDER, ID_PREFIX, PROMPT, } from '../constants.js';
export class ProcessManager {
    baseDir;
    processStore;
    programStore;
    constructor(baseDir) {
        this.baseDir = baseDir;
        this.processStore = new FileProcessStore(baseDir);
        this.programStore = new FileProgramStore(baseDir);
    }
    // --- Program Management ---
    async registerProgram(program) {
        await this.programStore.save(program);
    }
    async getProgram(name) {
        return this.programStore.load(name);
    }
    async listPrograms() {
        return this.programStore.loadAll();
    }
    async deleteProgram(name) {
        await this.programStore.delete(name);
    }
    // --- Process Management ---
    async createProcess(programName, processId, configOverrides) {
        const program = await this.programStore.load(programName);
        if (!program) {
            throw new Error(`Program not found: ${programName}`);
        }
        const id = processId ?? `${programName}-${nanoid(NANOID_LENGTH_POSITION)}`;
        const workDir = path.join(this.baseDir, PROCESS_DIR, id);
        const memoryDir = path.join(this.baseDir, DATA_DIR, id, 'memory');
        const process = {
            id,
            programName,
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
        // Create process directory structure
        await fs.mkdir(workDir, { recursive: true });
        await fs.mkdir(path.join(workDir, RULES_SUBDIR), { recursive: true });
        await fs.mkdir(path.join(workDir, SKILLS_SUBDIR), { recursive: true });
        await fs.mkdir(path.join(workDir, SESSIONS_SUBDIR), { recursive: true });
        await fs.mkdir(memoryDir, { recursive: true });
        // Generate CLAUDE.md from program
        await this.generateClaudeMd(process, program);
        // Generate rules if defined
        if (program.rules) {
            for (const rule of program.rules) {
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
        await this.processStore.save(process);
        return process;
    }
    async getProcess(id) {
        return this.processStore.load(id);
    }
    async listProcesses() {
        return this.processStore.loadAll();
    }
    async updateProcess(id, patch) {
        const proc = await this.getProcess(id);
        if (!proc)
            throw new Error(`Process not found: ${id}`);
        const updated = {
            ...proc,
            ...patch,
            id: proc.id, // prevent id change
            updatedAt: Date.now(),
        };
        await this.processStore.save(updated);
        return updated;
    }
    async setStatus(id, status) {
        await this.updateProcess(id, { status });
    }
    async destroyProcess(id) {
        await this.processStore.delete(id);
    }
    // --- Task Management ---
    async enqueueTask(processId, task) {
        const proc = await this.getProcess(processId);
        if (!proc)
            throw new Error(`Process not found: ${processId}`);
        const fullTask = {
            ...task,
            id: `${ID_PREFIX.TASK}${nanoid(NANOID_LENGTH_TASK)}`,
            status: TASK_STATUS.PENDING,
            createdAt: Date.now(),
        };
        proc.taskQueue.push(fullTask);
        await this.processStore.save(proc);
        return fullTask;
    }
    async dequeueTask(processId) {
        const proc = await this.getProcess(processId);
        if (!proc)
            return null;
        // Sort by priority, then by creation time
        const pending = proc.taskQueue
            .filter(t => t.status === TASK_STATUS.PENDING)
            .sort((a, b) => {
            const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
            return pd !== 0 ? pd : a.createdAt - b.createdAt;
        });
        if (pending.length === 0)
            return null;
        const task = pending[0];
        task.status = TASK_STATUS.RUNNING;
        proc.currentTask = task;
        await this.processStore.save(proc);
        return task;
    }
    async completeTask(processId, taskId, result) {
        const proc = await this.getProcess(processId);
        if (!proc)
            throw new Error(`Process not found: ${processId}`);
        const task = proc.taskQueue.find(t => t.id === taskId);
        if (!task)
            throw new Error(`Task not found: ${taskId}`);
        task.status = TASK_STATUS.DONE;
        task.result = result;
        task.completedAt = Date.now();
        if (proc.currentTask?.id === taskId) {
            proc.currentTask = undefined;
        }
        await this.processStore.save(proc);
    }
    async failTask(processId, taskId, error) {
        const proc = await this.getProcess(processId);
        if (!proc)
            throw new Error(`Process not found: ${processId}`);
        const task = proc.taskQueue.find(t => t.id === taskId);
        if (!task)
            throw new Error(`Task not found: ${taskId}`);
        task.status = TASK_STATUS.FAILED;
        task.result = error;
        task.completedAt = Date.now();
        if (proc.currentTask?.id === taskId) {
            proc.currentTask = undefined;
        }
        await this.processStore.save(proc);
    }
    // --- Output Routes ---
    async addOutputRoute(processId, route) {
        const proc = await this.getProcess(processId);
        if (!proc)
            throw new Error(`Process not found: ${processId}`);
        proc.outputRoutes.push(route);
        await this.processStore.save(proc);
    }
    // --- Helpers ---
    async generateClaudeMd(process, program) {
        const lines = [
            PROMPT.CLAUDE_MD_TITLE(process.id),
            '',
            PROMPT.CLAUDE_MD_ROLE(program.name),
            '',
            program.description,
            '',
        ];
        if (program.systemPromptAppend) {
            lines.push(PROMPT.SUPPLEMENTARY_HEADER, '', program.systemPromptAppend, '');
        }
        lines.push(PROMPT.CLAUDE_MD_MEMORY_HEADER, '', ...PROMPT.CLAUDE_MD_MEMORY_INSTRUCTIONS, '');
        await fs.writeFile(path.join(process.workDir, CLAUDE_MD_FILE), lines.join('\n'));
    }
}
//# sourceMappingURL=manager.js.map