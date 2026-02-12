import type { Position, RoleTemplate, Task, OutputRoute, PositionStatus } from './types.js';
export declare class PositionManager {
    private baseDir;
    private positionStore;
    private roleTemplateStore;
    constructor(baseDir: string);
    registerRoleTemplate(template: RoleTemplate): Promise<void>;
    getRoleTemplate(name: string): Promise<RoleTemplate | null>;
    listRoleTemplates(): Promise<RoleTemplate[]>;
    deleteRoleTemplate(name: string): Promise<void>;
    createPosition(roleTemplateName: string, positionId?: string, configOverrides?: Partial<RoleTemplate>): Promise<Position>;
    getPosition(id: string): Promise<Position | null>;
    listPositions(): Promise<Position[]>;
    updatePosition(id: string, patch: Partial<Position>): Promise<Position>;
    setStatus(id: string, status: PositionStatus): Promise<void>;
    destroyPosition(id: string): Promise<void>;
    enqueueTask(positionId: string, task: Omit<Task, 'id' | 'status' | 'createdAt'>): Promise<Task>;
    dequeueTask(positionId: string): Promise<Task | null>;
    completeTask(positionId: string, taskId: string, result: unknown): Promise<void>;
    failTask(positionId: string, taskId: string, error: unknown): Promise<void>;
    addOutputRoute(positionId: string, route: OutputRoute): Promise<void>;
    private generateClaudeMd;
}
//# sourceMappingURL=manager.d.ts.map