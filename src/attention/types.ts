// Attention domain types

import type { MemoryStore } from '../memory/types.js';
import type { Position, RoleTemplate, Task } from '../position/types.js';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AttentionInput {
  prompt: string;
  systemPromptAppend: string;
  conversationHistory?: ConversationTurn[];
  context: AttentionContext;
}

export interface TodoItem {
  text: string;
  done: boolean;
}

export interface AttentionContext {
  position: Position;
  roleTemplate: RoleTemplate;
  task: Task;
  workflowSource?: string;
  memoryStore: MemoryStore;
  globalMemoryStore: MemoryStore;
  todoItems?: TodoItem[];
}

export interface AttentionOutput {
  prompt: string;
  systemPromptAppend: string;
  conversationHistory?: ConversationTurn[];
}

export interface AttentionStrategy {
  name: string;
  priority: number;
  enhance(input: AttentionInput): Promise<AttentionOutput>;
}
