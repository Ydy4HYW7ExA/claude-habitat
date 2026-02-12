import type { Process, ProcessStore, Program, ProgramStore } from './types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PROCESS_DIR, PROGRAM_DIR, PROGRAM_APP_DIR, MANIFEST_FILE, STATE_FILE } from '../constants.js';

export class FileProcessStore implements ProcessStore {
  constructor(private baseDir: string) {}

  private processPath(id: string): string {
    return path.join(this.baseDir, PROCESS_DIR, id, STATE_FILE);
  }

  async save(process: Process): Promise<void> {
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

  async load(processId: string): Promise<Process | null> {
    try {
      const data = await fs.readFile(this.processPath(processId), 'utf-8');
      const parsed = JSON.parse(data);
      return parsed as Process;
    } catch {
      return null;
    }
  }

  async loadAll(): Promise<Process[]> {
    const processDir = path.join(this.baseDir, PROCESS_DIR);
    try {
      const dirs = await fs.readdir(processDir);
      const processes: Process[] = [];
      for (const dir of dirs) {
        const proc = await this.load(dir);
        if (proc) processes.push(proc);
      }
      return processes;
    } catch {
      return [];
    }
  }

  async delete(processId: string): Promise<void> {
    const dir = path.join(this.baseDir, PROCESS_DIR, processId);
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export class FileProgramStore implements ProgramStore {
  constructor(private baseDir: string) {}

  private programPath(name: string): string {
    return path.join(this.baseDir, PROGRAM_DIR, PROGRAM_APP_DIR, name, MANIFEST_FILE);
  }

  async save(program: Program): Promise<void> {
    const filePath = this.programPath(program.name);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(program, null, 2));
  }

  async load(name: string): Promise<Program | null> {
    try {
      const data = await fs.readFile(this.programPath(name), 'utf-8');
      return JSON.parse(data) as Program;
    } catch {
      return null;
    }
  }

  async loadAll(): Promise<Program[]> {
    const appDir = path.join(this.baseDir, PROGRAM_DIR, PROGRAM_APP_DIR);
    try {
      const entries = await fs.readdir(appDir, { withFileTypes: true });
      const programs: Program[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const prog = await this.load(entry.name);
        if (prog) programs.push(prog);
      }
      return programs;
    } catch {
      return [];
    }
  }

  async delete(name: string): Promise<void> {
    const dir = path.join(this.baseDir, PROGRAM_DIR, PROGRAM_APP_DIR, name);
    await fs.rm(dir, { recursive: true, force: true });
  }
}
