import { truncateSummary, DEFAULT_RECALL_LIMIT, MCP_SERVER_PREFIX, CONFIG_VERSION, MEMORY_LAYER, MEMORY_LAYERS, TOOL_NAME, EVENT_TYPE, TASK_EVENT_PREFIX, TASK_STATUS, mcpText, } from '../constants.js';
/**
 * Creates an MCP server with all position-level tools (memory + events).
 * Uses SDK's tool() and createSdkMcpServer() for proper registration.
 */
export async function createPositionMcpServer(deps) {
    const { tool, createSdkMcpServer } = await import('@anthropic-ai/claude-agent-sdk');
    const { z } = await import('zod/v4');
    const { memoryStore, globalMemoryStore, eventBus, position } = deps;
    const tools = [
        tool(TOOL_NAME.REMEMBER, '记录一条新记忆到岗位记忆库', {
            content: z.string().describe('记忆内容'),
            keywords: z.array(z.string()).optional().describe('关键词列表'),
            summary: z.string().optional().describe('一句话摘要'),
        }, async ({ content, keywords, summary }) => {
            const entry = await memoryStore.write({
                layer: MEMORY_LAYER.EPISODE,
                content,
                summary: summary ?? truncateSummary(content),
                keywords: keywords ?? [],
                refs: [],
                metadata: { positionId: position.id },
            });
            return { content: [mcpText(`Memory saved: ${entry.id}`)] };
        }),
        tool(TOOL_NAME.RECALL, '从岗位记忆库检索相关记忆', {
            query: z.string().describe('搜索关键词'),
            layer: z.enum(MEMORY_LAYERS).optional().describe('限定记忆层级'),
            limit: z.number().optional().describe('返回条数上限'),
        }, async ({ query, layer, limit }) => {
            const results = await memoryStore.search(query, {
                // Cast needed: SDK tool() erases Zod's inferred type to unknown
                layer: layer,
                limit: limit ?? DEFAULT_RECALL_LIMIT,
            });
            const formatted = results.map(e => `[${e.id}] (${e.layer}) ${e.summary}\n${e.content}`).join('\n\n---\n\n');
            return { content: [mcpText(formatted || 'No memories found.')] };
        }),
        tool(TOOL_NAME.FORGET, '删除一条记忆', {
            id: z.string().describe('记忆条目 ID'),
            reason: z.string().describe('删除原因'),
        }, async ({ id, reason }) => {
            await memoryStore.delete(id);
            return { content: [mcpText(`Memory ${id} deleted. Reason: ${reason}`)] };
        }),
        tool(TOOL_NAME.REWRITE_MEMORY, '重写一条记忆（失败擦除/经验提炼）', {
            id: z.string().describe('记忆条目 ID'),
            newContent: z.string().describe('新内容'),
            newSummary: z.string().optional().describe('新摘要'),
            newKeywords: z.array(z.string()).optional().describe('新关键词'),
        }, async ({ id, newContent, newSummary, newKeywords }) => {
            await memoryStore.rewrite(id, newContent, newSummary ?? truncateSummary(newContent), newKeywords ?? []);
            return { content: [mcpText(`Memory ${id} rewritten.`)] };
        }),
        tool(TOOL_NAME.RECALL_GLOBAL, '从全局记忆库检索', {
            query: z.string().describe('搜索关键词'),
            limit: z.number().optional().describe('返回条数上限'),
        }, async ({ query, limit }) => {
            const results = await globalMemoryStore.search(query, { limit: limit ?? DEFAULT_RECALL_LIMIT });
            const formatted = results.map(e => `[${e.id}] (${e.layer}) ${e.summary}\n${e.content}`).join('\n\n---\n\n');
            return { content: [mcpText(formatted || 'No global memories found.')] };
        }),
        tool(TOOL_NAME.REMEMBER_GLOBAL, '写入全局记忆库', {
            content: z.string().describe('记忆内容'),
            keywords: z.array(z.string()).optional().describe('关键词列表'),
            summary: z.string().optional().describe('一句话摘要'),
        }, async ({ content, keywords, summary }) => {
            const entry = await globalMemoryStore.write({
                layer: MEMORY_LAYER.EPISODE,
                content,
                summary: summary ?? truncateSummary(content),
                keywords: keywords ?? [],
                refs: [],
                metadata: { positionId: position.id },
            });
            return { content: [mcpText(`Global memory saved: ${entry.id}`)] };
        }),
        tool(TOOL_NAME.EMIT_TASK, '向其他岗位发送任务', {
            taskType: z.string().describe('任务类型'),
            payload: z.record(z.string(), z.unknown()).describe('任务数据'),
            targetPositionId: z.string().optional().describe('目标岗位 ID'),
        }, async ({ taskType, payload, targetPositionId }) => {
            const event = eventBus.createEvent(`${TASK_EVENT_PREFIX}${taskType}`, position.id, payload, targetPositionId);
            await eventBus.emit(event);
            return { content: [mcpText(`Task emitted: ${event.id}`)] };
        }),
        tool(TOOL_NAME.GET_MY_TASKS, '查看我的待处理任务', {}, async () => {
            const pending = position.taskQueue.filter(t => t.status === TASK_STATUS.PENDING);
            return { content: [mcpText(JSON.stringify(pending, null, 2))] };
        }),
        tool(TOOL_NAME.REPORT_STATUS, '报告当前状态', {
            status: z.string().describe('状态描述'),
            progress: z.number().min(0).max(100).optional().describe('进度百分比'),
        }, async ({ status, progress }) => {
            const event = eventBus.createEvent(EVENT_TYPE.POSITION_STATUS_REPORT, position.id, { status, progress });
            await eventBus.emit(event);
            return { content: [mcpText('Status reported.')] };
        }),
        tool(TOOL_NAME.REQUEST_WORKFLOW_CHANGE, '提出工作流修改建议', {
            description: z.string().describe('修改描述'),
            suggestedCode: z.string().optional().describe('建议的新代码'),
            reason: z.string().describe('修改原因'),
        }, async ({ description, suggestedCode, reason }) => {
            const event = eventBus.createEvent(EVENT_TYPE.WORKFLOW_CHANGE_REQUEST, position.id, { description, suggestedCode, reason });
            await eventBus.emit(event);
            return { content: [mcpText('Workflow change request submitted.')] };
        }),
    ];
    return createSdkMcpServer({
        name: `${MCP_SERVER_PREFIX}${position.id}`,
        version: CONFIG_VERSION,
        tools,
    });
}
//# sourceMappingURL=mcp-tools.js.map