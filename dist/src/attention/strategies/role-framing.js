import { MAX_PAYLOAD_DISPLAY_LENGTH, PROMPT } from '../../constants.js';
/**
 * Priority 10 — Injects role framing into system prompt.
 * Sources: Program.systemPromptAppend + position context + todo items.
 */
export class RoleFramingStrategy {
    name = 'role-framing';
    priority = 10;
    async enhance(input) {
        const { context } = input;
        const { position, roleTemplate, task } = context;
        const lines = [];
        lines.push(PROMPT.POSITION_IDENTITY(position.id));
        lines.push(PROMPT.ROLE_LABEL(roleTemplate.name, roleTemplate.description));
        lines.push('');
        if (roleTemplate.systemPromptAppend) {
            lines.push(roleTemplate.systemPromptAppend);
            lines.push('');
        }
        lines.push(PROMPT.CURRENT_TASK_HEADER);
        lines.push(PROMPT.TASK_TYPE_LABEL(task.type));
        lines.push(PROMPT.TASK_SOURCE_LABEL(task.sourcePositionId));
        lines.push(PROMPT.TASK_PRIORITY_LABEL(task.priority));
        if (task.payload) {
            const payloadStr = JSON.stringify(task.payload, null, 2);
            lines.push(`${PROMPT.TASK_DATA_LABEL}${payloadStr.length > MAX_PAYLOAD_DISPLAY_LENGTH ? payloadStr.slice(0, MAX_PAYLOAD_DISPLAY_LENGTH) + PROMPT.PAYLOAD_TRUNCATED : payloadStr}`);
        }
        // Inject todo items if present
        if (context.todoItems && context.todoItems.length > 0) {
            lines.push('');
            lines.push(PROMPT.TODO_HEADER);
            for (const item of context.todoItems) {
                lines.push(item.done ? PROMPT.TODO_ITEM_DONE(item.text) : PROMPT.TODO_ITEM_PENDING(item.text));
            }
        }
        const append = input.systemPromptAppend
            ? input.systemPromptAppend + '\n\n' + lines.join('\n')
            : lines.join('\n');
        return {
            ...input,
            systemPromptAppend: append,
        };
    }
}
//# sourceMappingURL=role-framing.js.map