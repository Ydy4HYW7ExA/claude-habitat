export type HookEvent =
  | 'before:prompt'
  | 'before:tool'
  | 'after:tool'
  | 'before:create'
  | 'after:create'
  | 'before:update'
  | 'after:update'
  | 'before:delete'
  | 'after:delete'
  | 'on:error';

export interface HookHandler {
  id: string;
  event: HookEvent;
  name: string;
  priority: number;
  handler: (context: HookContext) => Promise<void> | void;
}

export interface HookContext {
  event: HookEvent;
  toolName?: string;
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
  error?: Error;
}
