import type { Process, Program, Task, OutputRoute, ProcessStatus } from './types.js';
export declare class ProcessManager {
    private baseDir;
    private processStore;
    private programStore;
    constructor(baseDir: string);
    registerProgram(program: Program): Promise<void>;
    getProgram(name: string): Promise<Program | null>;
    listPrograms(): Promise<Program[]>;
    deleteProgram(name: string): Promise<void>;
    createProcess(programName: string, processId?: string, configOverrides?: Partial<Program>): Promise<Process>;
    getProcess(id: string): Promise<Process | null>;
    listProcesses(): Promise<Process[]>;
    updateProcess(id: string, patch: Partial<Process>): Promise<Process>;
    setStatus(id: string, status: ProcessStatus): Promise<void>;
    destroyProcess(id: string): Promise<void>;
    enqueueTask(processId: string, task: Omit<Task, 'id' | 'status' | 'createdAt'>): Promise<Task>;
    dequeueTask(processId: string): Promise<Task | null>;
    completeTask(processId: string, taskId: string, result: unknown): Promise<void>;
    failTask(processId: string, taskId: string, error: unknown): Promise<void>;
    addOutputRoute(processId: string, route: OutputRoute): Promise<void>;
    private generateClaudeMd;
}
//# sourceMappingURL=manager.d.ts.map