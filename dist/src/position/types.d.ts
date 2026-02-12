export interface RoleTemplate {
    name: string;
    description: string;
    workflowPath: string;
    systemPromptAppend?: string;
    allowedTools?: string[];
    disallowedTools?: string[];
    mcpTools?: McpToolDefinition[];
    skills?: string[];
    rules?: RuleDefinition[];
    model?: 'opus' | 'sonnet' | 'haiku';
    maxTurns?: number;
    permissionMode?: PermissionMode;
    isAdmin?: boolean;
    attentionStrategies?: string[];
    memoryConfig?: {
        autoExtract: boolean;
        consolidationThreshold: number;
    };
}
export interface McpToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
export interface RuleDefinition {
    name: string;
    paths: string[];
    content: string;
}
export type PermissionMode = 'bypassPermissions' | 'default';
export type PositionStatus = 'idle' | 'busy' | 'error' | 'stopped';
export interface Position {
    id: string;
    roleTemplateName: string;
    status: PositionStatus;
    lastSessionId?: string;
    sessionHistory: string[];
    taskQueue: Task[];
    currentTask?: Task;
    outputRoutes: OutputRoute[];
    config?: Partial<RoleTemplate>;
    workDir: string;
    memoryDir: string;
    createdAt: number;
    updatedAt: number;
}
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';
export interface Task {
    id: string;
    sourcePositionId: string;
    targetPositionId: string;
    type: string;
    payload: unknown;
    priority: TaskPriority;
    status: TaskStatus;
    result?: unknown;
    createdAt: number;
    completedAt?: number;
}
export interface OutputRoute {
    taskType: string;
    targetPositionId: string;
    transform?: (result: unknown) => unknown;
    condition?: (result: unknown) => boolean;
}
export interface PositionStore {
    save(position: Position): Promise<void>;
    load(positionId: string): Promise<Position | null>;
    loadAll(): Promise<Position[]>;
    delete(positionId: string): Promise<void>;
}
export interface RoleTemplateStore {
    save(template: RoleTemplate): Promise<void>;
    load(name: string): Promise<RoleTemplate | null>;
    loadAll(): Promise<RoleTemplate[]>;
    delete(name: string): Promise<void>;
}
//# sourceMappingURL=types.d.ts.map