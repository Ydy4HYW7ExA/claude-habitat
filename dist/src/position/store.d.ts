import type { Position, PositionStore, RoleTemplate, RoleTemplateStore } from './types.js';
export declare class FilePositionStore implements PositionStore {
    private baseDir;
    constructor(baseDir: string);
    private positionPath;
    save(position: Position): Promise<void>;
    load(positionId: string): Promise<Position | null>;
    loadAll(): Promise<Position[]>;
    delete(positionId: string): Promise<void>;
}
export declare class FileRoleTemplateStore implements RoleTemplateStore {
    private baseDir;
    constructor(baseDir: string);
    private templatePath;
    save(template: RoleTemplate): Promise<void>;
    load(name: string): Promise<RoleTemplate | null>;
    loadAll(): Promise<RoleTemplate[]>;
    delete(name: string): Promise<void>;
}
//# sourceMappingURL=store.d.ts.map