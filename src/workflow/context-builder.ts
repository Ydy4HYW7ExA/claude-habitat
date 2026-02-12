import type { WorkflowContext, AiOptions, AiResult, TodoItem } from './types.js';
import type { MemoryStore, MemoryEntry } from '../memory/types.js';
import type { Process, Program, Task } from '../position/types.js';
import { truncateSummary, DEFAULT_RECALL_LIMIT, MEMORY_LAYER } from '../constants.js';

export interface WorkflowDependencies {
  position: Process;
  roleTemplate: Program;
  task: Task;
  projectRoot: string;
  memoryStore: MemoryStore;
  globalMemoryStore: MemoryStore;
  aiCall: (prompt: string, options?: AiOptions) => Promise<AiResult>;
  emitFn: (taskType: string, payload: unknown, targetPositionId?: string) => Promise<void>;
  callFn: (targetPositionId: string, taskType: string, payload: unknown) => Promise<unknown>;
  signal: AbortSignal;
  logger: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
}

export function buildWorkflowContext(deps: WorkflowDependencies): WorkflowContext {
  const {
    position, roleTemplate, task, projectRoot,
    memoryStore, globalMemoryStore,
    aiCall, emitFn, callFn, signal, logger,
  } = deps;

  const memory: WorkflowContext['memory'] = {
    async remember(content: string, keywords?: string[]): Promise<string> {
      const entry = await memoryStore.write({
        layer: MEMORY_LAYER.EPISODE,
        content,
        summary: truncateSummary(content),
        keywords: keywords ?? [],
        refs: [],
        metadata: {
          positionId: position.id,
          taskId: task.id,
        },
      });
      return entry.id;
    },

    async recall(query: string, limit?: number): Promise<MemoryEntry[]> {
      return memoryStore.search(query, { limit: limit ?? DEFAULT_RECALL_LIMIT });
    },

    async forget(id: string, reason: string): Promise<void> {
      logger('info', `Forgetting memory ${id}: ${reason}`);
      await memoryStore.delete(id);
    },

    async rewrite(id: string, newContent: string): Promise<void> {
      await memoryStore.rewrite(id, newContent, truncateSummary(newContent), []);
    },

    async recallGlobal(query: string, limit?: number): Promise<MemoryEntry[]> {
      return globalMemoryStore.search(query, { limit: limit ?? DEFAULT_RECALL_LIMIT });
    },

    async rememberGlobal(content: string, keywords?: string[]): Promise<string> {
      const entry = await globalMemoryStore.write({
        layer: MEMORY_LAYER.EPISODE,
        content,
        summary: truncateSummary(content),
        keywords: keywords ?? [],
        refs: [],
        metadata: {
          positionId: position.id,
          taskId: task.id,
        },
      });
      return entry.id;
    },
  };

  // askUser: delegates to ai() with a prompt that triggers AskUserQuestion tool
  const askUser = async (question: string): Promise<string> => {
    const result = await aiCall(
      `Ask the user the following question and return their response verbatim:\n\n${question}`,
      { maxTurns: 3 },
    );
    return result.text;
  };

  // parallel: execute multiple ai() calls concurrently
  const parallel = async (calls: { prompt: string; options?: AiOptions }[]): Promise<AiResult[]> => {
    return Promise.all(calls.map(c => aiCall(c.prompt, c.options)));
  };

  // todo: in-memory task list for workflow attention enhancement
  const todoItems: TodoItem[] = [];
  const todo: WorkflowContext['todo'] = {
    add(item: string) {
      todoItems.push({ text: item, done: false });
    },
    complete(item: string) {
      const found = todoItems.find(t => t.text === item && !t.done);
      if (found) found.done = true;
    },
    list(): TodoItem[] {
      return [...todoItems];
    },
  };

  return {
    ai: aiCall,
    emit: emitFn,
    call: callFn,
    memory,
    askUser,
    parallel,
    todo,
    position,
    roleTemplate,
    projectRoot,
    task,
    args: task.payload,
    signal,
    log: logger,
  };
}
