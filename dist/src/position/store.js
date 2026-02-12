import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PROCESS_DIR, PROGRAM_DIR, PROGRAM_APP_DIR, MANIFEST_FILE, STATE_FILE } from '../constants.js';
export class FileProcessStore {
    baseDir;
    constructor(baseDir) {
        this.baseDir = baseDir;
    }
    processPath(id) {
        return path.join(this.baseDir, PROCESS_DIR, id, STATE_FILE);
    }
    async save(process) {
        const filePath = this.processPath(process.id);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        // Serialize without function fields (outputRoutes transform/condition are runtime-only)
        const serializable = {
            ...process,
            outputRoutes: process.outputRoutes.map(r => ({
                taskType: r.taskType,
                targetPositionId: r.targetPositionId,
                // Preserve function names as string references for debugging/logging
                hasTransform: typeof r.transform === 'function',
                hasCondition: typeof r.condition === 'function',
            })),
        };
        await fs.writeFile(filePath, JSON.stringify(serializable, null, 2));
    }
    async load(processId) {
        try {
            const data = await fs.readFile(this.processPath(processId), 'utf-8');
            const parsed = JSON.parse(data);
            return parsed;
        }
        catch {
            return null;
        }
    }
    async loadAll() {
        const processDir = path.join(this.baseDir, PROCESS_DIR);
        try {
            const dirs = await fs.readdir(processDir);
            const processes = [];
            for (const dir of dirs) {
                const proc = await this.load(dir);
                if (proc)
                    processes.push(proc);
            }
            return processes;
        }
        catch {
            return [];
        }
    }
    async delete(processId) {
        const dir = path.join(this.baseDir, PROCESS_DIR, processId);
        await fs.rm(dir, { recursive: true, force: true });
    }
}
export class FileProgramStore {
    baseDir;
    constructor(baseDir) {
        this.baseDir = baseDir;
    }
    programPath(name) {
        return path.join(this.baseDir, PROGRAM_DIR, PROGRAM_APP_DIR, name, MANIFEST_FILE);
    }
    async save(program) {
        const filePath = this.programPath(program.name);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(program, null, 2));
    }
    async load(name) {
        try {
            const data = await fs.readFile(this.programPath(name), 'utf-8');
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    }
    async loadAll() {
        const appDir = path.join(this.baseDir, PROGRAM_DIR, PROGRAM_APP_DIR);
        try {
            const entries = await fs.readdir(appDir, { withFileTypes: true });
            const programs = [];
            for (const entry of entries) {
                if (!entry.isDirectory())
                    continue;
                const prog = await this.load(entry.name);
                if (prog)
                    programs.push(prog);
            }
            return programs;
        }
        catch {
            return [];
        }
    }
    async delete(name) {
        const dir = path.join(this.baseDir, PROGRAM_DIR, PROGRAM_APP_DIR, name);
        await fs.rm(dir, { recursive: true, force: true });
    }
}
//# sourceMappingURL=store.js.map