import type { Process, ProcessStore, Program, ProgramStore } from './types.js';
export declare class FileProcessStore implements ProcessStore {
    private baseDir;
    constructor(baseDir: string);
    private processPath;
    save(process: Process): Promise<void>;
    load(processId: string): Promise<Process | null>;
    loadAll(): Promise<Process[]>;
    delete(processId: string): Promise<void>;
}
export declare class FileProgramStore implements ProgramStore {
    private baseDir;
    constructor(baseDir: string);
    private programPath;
    save(program: Program): Promise<void>;
    load(name: string): Promise<Program | null>;
    loadAll(): Promise<Program[]>;
    delete(name: string): Promise<void>;
}
//# sourceMappingURL=store.d.ts.map