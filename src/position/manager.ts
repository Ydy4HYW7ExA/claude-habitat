import type {
  Process,
  Program,
  Task,
  OutputRoute,
  ProcessStatus,
} from './types.js';
import { FileProcessStore, FileProgramStore } from './store.js';
import { nanoid } from 'nanoid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  PROCESS_DIR, DATA_DIR, RULES_SUBDIR, SKILLS_SUBDIR,
  SESSIONS_SUBDIR, HISTORY_FILE, CLAUDE_MD_FILE,
  NANOID_LENGTH_POSITION, NANOID_LENGTH_TASK,
  POSITION_STATUS, TASK_STATUS, PRIORITY_ORDER, ID_PREFIX,
  PROMPT,
} from '../constants.js';

export class ProcessManager {
  private processStore: FileProcessStore;
  private programStore: FileProgramStore;

  constructor(private baseDir: string) {
    this.processStore = new FileProcessStore(baseDir);
    this.programStore = new FileProgramStore(baseDir);
  }

  // --- Program Management ---

  async registerProgram(program: Program): Promise<void> {
    await this.programStore.save(program);
  }

  async getProgram(name: string): Promise<Program | null> {
    return this.programStore.load(name);
  }

  async listPrograms(): Promise<Program[]> {
    return this.programStore.loadAll();
  }

  async deleteProgram(name: string): Promise<void> {
    await this.programStore.delete(name);
  }

  // --- Process Management ---

  async createProcess(
    programName: string,
    processId?: string,
    configOverrides?: Partial<Program>,
  ): Promise<Process> {
    const program = await this.programStore.load(programName);
    if (!program) {
      throw new Error(`Program not found: ${programName}`);
    }

    const id = processId ?? `${programName}-${nanoid(NANOID_LENGTH_POSITION)}`;
    const workDir = path.join(this.baseDir, PROCESS_DIR, id);
    const memoryDir = path.join(this.baseDir, DATA_DIR, id, 'memory');

    const process: Process = {
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
    await fs.writeFile(
      path.join(workDir, SESSIONS_SUBDIR, HISTORY_FILE),
      JSON.stringify({ sessions: [] }, null, 2),
    );

    // Persist
    await this.processStore.save(process);

    return process;
  }

  async getProcess(id: string): Promise<Process | null> {
    return this.processStore.load(id);
  }

  async listProcesses(): Promise<Process[]> {
    return this.processStore.loadAll();
  }

  async updateProcess(id: string, patch: Partial<Process>): Promise<Process> {
    const proc = await this.getProcess(id);
    if (!proc) throw new Error(`Process not found: ${id}`);

    const updated: Process = {
      ...proc,
      ...patch,
      id: proc.id, // prevent id change
      updatedAt: Date.now(),
    };

    await this.processStore.save(updated);
    return updated;
  }

  async setStatus(id: string, status: ProcessStatus): Promise<void> {
    await this.updateProcess(id, { status });
  }

  async destroyProcess(id: string): Promise<void> {
    await this.processStore.delete(id);
  }

  // --- Task Management ---

  async enqueueTask(processId: string, task: Omit<Task, 'id' | 'status' | 'createdAt'>): Promise<Task> {
    const proc = await this.getProcess(processId);
    if (!proc) throw new Error(`Process not found: ${processId}`);

    const fullTask: Task = {
      ...task,
      id: `${ID_PREFIX.TASK}${nanoid(NANOID_LENGTH_TASK)}`,
      status: TASK_STATUS.PENDING,
      createdAt: Date.now(),
    };

    proc.taskQueue.push(fullTask);
    await this.processStore.save(proc);
    return fullTask;
  }

  async dequeueTask(processId: string): Promise<Task | null> {
    const proc = await this.getProcess(processId);
    if (!proc) return null;

    // Sort by priority, then by creation time
    const pending = proc.taskQueue
      .filter(t => t.status === TASK_STATUS.PENDING)
      .sort((a, b) => {
        const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        return pd !== 0 ? pd : a.createdAt - b.createdAt;
      });

    if (pending.length === 0) return null;

    const task = pending[0];
    task.status = TASK_STATUS.RUNNING;
    proc.currentTask = task;
    await this.processStore.save(proc);
    return task;
  }

  async completeTask(processId: string, taskId: string, result: unknown): Promise<void> {
    const proc = await this.getProcess(processId);
    if (!proc) throw new Error(`Process not found: ${processId}`);

    const task = proc.taskQueue.find(t => t.id === taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    task.status = TASK_STATUS.DONE;
    task.result = result;
    task.completedAt = Date.now();

    if (proc.currentTask?.id === taskId) {
      proc.currentTask = undefined;
    }

    await this.processStore.save(proc);
  }

  async failTask(processId: string, taskId: string, error: unknown): Promise<void> {
    const proc = await this.getProcess(processId);
    if (!proc) throw new Error(`Process not found: ${processId}`);

    const task = proc.taskQueue.find(t => t.id === taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    task.status = TASK_STATUS.FAILED;
    task.result = error;
    task.completedAt = Date.now();

    if (proc.currentTask?.id === taskId) {
      proc.currentTask = undefined;
    }

    await this.processStore.save(proc);
  }

  // --- Output Routes ---

  async addOutputRoute(processId: string, route: OutputRoute): Promise<void> {
    const proc = await this.getProcess(processId);
    if (!proc) throw new Error(`Process not found: ${processId}`);

    proc.outputRoutes.push(route);
    await this.processStore.save(proc);
  }

  // --- Helpers ---

  private async generateClaudeMd(process: Process, program: Program): Promise<void> {
    const lines: string[] = [
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

    lines.push(
      PROMPT.CLAUDE_MD_MEMORY_HEADER,
      '',
      ...PROMPT.CLAUDE_MD_MEMORY_INSTRUCTIONS,
      '',
    );

    await fs.writeFile(path.join(process.workDir, CLAUDE_MD_FILE), lines.join('\n'));
  }
}
