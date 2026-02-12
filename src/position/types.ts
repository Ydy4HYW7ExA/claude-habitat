// Position domain types

export interface Program {
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

export type ProcessStatus = 'idle' | 'busy' | 'error' | 'stopped';

export interface Process {
  id: string;
  programName: string;
  status: ProcessStatus;

  lastSessionId?: string;
  sessionHistory: string[];

  taskQueue: Task[];
  currentTask?: Task;

  outputRoutes: OutputRoute[];

  config?: Partial<Program>;

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

export interface ProcessStore {
  save(process: Process): Promise<void>;
  load(processId: string): Promise<Process | null>;
  loadAll(): Promise<Process[]>;
  delete(processId: string): Promise<void>;
}

export interface ProgramStore {
  save(program: Program): Promise<void>;
  load(name: string): Promise<Program | null>;
  loadAll(): Promise<Program[]>;
  delete(name: string): Promise<void>;
}

