import type { Position, PositionStore, RoleTemplate, RoleTemplateStore } from './types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { POSITIONS_DIR, ROLES_DIR, STATE_FILE } from '../constants.js';

export class FilePositionStore implements PositionStore {
  constructor(private baseDir: string) {}

  private positionPath(id: string): string {
    return path.join(this.baseDir, POSITIONS_DIR, id, STATE_FILE);
  }

  async save(position: Position): Promise<void> {
    const filePath = this.positionPath(position.id);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    // Serialize without function fields (outputRoutes transform/condition are runtime-only)
    const serializable = {
      ...position,
      outputRoutes: position.outputRoutes.map(r => ({
        taskType: r.taskType,
        targetPositionId: r.targetPositionId,
        // Preserve function names as string references for debugging/logging
        hasTransform: typeof r.transform === 'function',
        hasCondition: typeof r.condition === 'function',
      })),
    };
    await fs.writeFile(filePath, JSON.stringify(serializable, null, 2));
  }

  async load(positionId: string): Promise<Position | null> {
    try {
      const data = await fs.readFile(this.positionPath(positionId), 'utf-8');
      return JSON.parse(data) as Position;
    } catch {
      return null;
    }
  }

  async loadAll(): Promise<Position[]> {
    const positionsDir = path.join(this.baseDir, POSITIONS_DIR);
    try {
      const dirs = await fs.readdir(positionsDir);
      const positions: Position[] = [];
      for (const dir of dirs) {
        const pos = await this.load(dir);
        if (pos) positions.push(pos);
      }
      return positions;
    } catch {
      return [];
    }
  }

  async delete(positionId: string): Promise<void> {
    const dir = path.join(this.baseDir, POSITIONS_DIR, positionId);
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export class FileRoleTemplateStore implements RoleTemplateStore {
  constructor(private baseDir: string) {}

  private templatePath(name: string): string {
    return path.join(this.baseDir, ROLES_DIR, `${name}.json`);
  }

  async save(template: RoleTemplate): Promise<void> {
    const filePath = this.templatePath(template.name);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(template, null, 2));
  }

  async load(name: string): Promise<RoleTemplate | null> {
    try {
      const data = await fs.readFile(this.templatePath(name), 'utf-8');
      return JSON.parse(data) as RoleTemplate;
    } catch {
      return null;
    }
  }

  async loadAll(): Promise<RoleTemplate[]> {
    const rolesDir = path.join(this.baseDir, ROLES_DIR);
    try {
      const files = await fs.readdir(rolesDir);
      const templates: RoleTemplate[] = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const name = path.basename(file, '.json');
        const tmpl = await this.load(name);
        if (tmpl) templates.push(tmpl);
      }
      return templates;
    } catch {
      return [];
    }
  }

  async delete(name: string): Promise<void> {
    try {
      await fs.unlink(this.templatePath(name));
    } catch {
      // ignore if not found
    }
  }
}
