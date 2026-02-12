import type { MemoryStore } from '../memory/types.js';
import type { Process, Program, Task } from '../position/types.js';
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
    position: Process;
    roleTemplate: Program;
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
//# sourceMappingURL=types.d.ts.map