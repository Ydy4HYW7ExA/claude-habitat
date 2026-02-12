import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { WORKFLOW_DIR, HABITAT_DIR, ORG_ARCHITECT_ID, MCP_ADMIN_SERVER_NAME, CONFIG_VERSION, ADMIN_TOOL_NAME, MODELS, TASK_PRIORITY, ADMIN_SAFE_FIELDS, mcpText, } from '../constants.js';
/**
 * Creates an MCP server with admin tools (org-architect only).
 * Uses SDK's tool() and createSdkMcpServer() for proper registration.
 */
export async function createAdminMcpServer(deps) {
    const { tool, createSdkMcpServer } = await import('@anthropic-ai/claude-agent-sdk');
    const { z } = await import('zod/v4');
    const { positionManager, projectRoot } = deps;
    const tools = [
        tool(ADMIN_TOOL_NAME.CREATE_ROLE_TEMPLATE, '创建新的职业模板', {
            name: z.string().describe('模板名称'),
            description: z.string().describe('职业描述'),
            workflowCode: z.string().describe('工作流 TypeScript 代码'),
            systemPromptAppend: z.string().optional().describe('追加到系统提示的指令'),
            model: z.enum(MODELS).optional().describe('默认模型'),
            allowedTools: z.array(z.string()).optional().describe('允许的工具列表'),
            disallowedTools: z.array(z.string()).optional().describe('禁止的工具列表'),
        }, async ({ name, description, workflowCode, systemPromptAppend, model, allowedTools, disallowedTools }) => {
            const workflowPath = path.join(HABITAT_DIR, WORKFLOW_DIR, `${name}.ts`);
            const fullWorkflowPath = path.join(projectRoot, workflowPath);
            await fs.mkdir(path.dirname(fullWorkflowPath), { recursive: true });
            await fs.writeFile(fullWorkflowPath, workflowCode);
            const template = {
                name,
                description,
                workflowPath,
                systemPromptAppend,
                model,
                allowedTools,
                disallowedTools,
            };
            await positionManager.registerRoleTemplate(template);
            return { content: [mcpText(`Role template '${name}' created.`)] };
        }),
        tool(ADMIN_TOOL_NAME.CREATE_POSITION, '从模板创建岗位实例', {
            roleTemplateName: z.string().describe('职业模板名称'),
            positionId: z.string().optional().describe('自定义岗位 ID'),
        }, async ({ roleTemplateName, positionId }) => {
            const position = await positionManager.createPosition(roleTemplateName, positionId);
            return { content: [mcpText(`Position '${position.id}' created from template '${roleTemplateName}'.`)] };
        }),
        tool(ADMIN_TOOL_NAME.MODIFY_POSITION, '修改岗位配置', {
            positionId: z.string().describe('岗位 ID'),
            changes: z.record(z.string(), z.unknown()).describe('要修改的字段'),
        }, async ({ positionId, changes }) => {
            // Whitelist safe fields to prevent overwriting id, createdAt, etc.
            const filtered = {};
            for (const [key, value] of Object.entries(changes)) {
                if (ADMIN_SAFE_FIELDS.has(key)) {
                    filtered[key] = value;
                }
            }
            await positionManager.updatePosition(positionId, filtered);
            return { content: [mcpText(`Position '${positionId}' updated.`)] };
        }),
        tool(ADMIN_TOOL_NAME.DELETE_POSITION, '删除岗位', {
            positionId: z.string().describe('岗位 ID'),
            reason: z.string().describe('删除原因'),
        }, async ({ positionId, reason }) => {
            await positionManager.destroyPosition(positionId);
            return { content: [mcpText(`Position '${positionId}' deleted. Reason: ${reason}`)] };
        }),
        tool(ADMIN_TOOL_NAME.MODIFY_WORKFLOW, '修改岗位工作流代码', {
            positionId: z.string().describe('岗位 ID'),
            newCode: z.string().describe('新的工作流代码'),
            reason: z.string().describe('修改原因'),
        }, async ({ positionId, newCode, reason }) => {
            const position = await positionManager.getPosition(positionId);
            if (!position) {
                return { content: [mcpText(`Position '${positionId}' not found.`)] };
            }
            const template = await positionManager.getRoleTemplate(position.roleTemplateName);
            if (!template) {
                return { content: [mcpText(`Role template '${position.roleTemplateName}' not found.`)] };
            }
            const workflowPath = position.config?.workflowPath ?? template.workflowPath;
            const fullPath = path.join(projectRoot, workflowPath);
            await fs.writeFile(fullPath, newCode);
            return { content: [mcpText(`Workflow for '${positionId}' updated. Reason: ${reason}`)] };
        }),
        tool(ADMIN_TOOL_NAME.LIST_POSITIONS, '列出所有岗位', {}, async () => {
            const positions = await positionManager.listPositions();
            const summary = positions.map(p => `${p.id} (${p.roleTemplateName}) — ${p.status}`).join('\n');
            return { content: [mcpText(summary || 'No positions.')] };
        }),
        tool(ADMIN_TOOL_NAME.GET_POSITION_STATUS, '查看岗位状态', {
            positionId: z.string().describe('岗位 ID'),
        }, async ({ positionId }) => {
            const position = await positionManager.getPosition(positionId);
            if (!position) {
                return { content: [mcpText(`Position '${positionId}' not found.`)] };
            }
            return { content: [mcpText(JSON.stringify(position, null, 2))] };
        }),
        tool(ADMIN_TOOL_NAME.DISPATCH_TASK, '向岗位派发任务', {
            targetPositionId: z.string().describe('目标岗位 ID'),
            taskType: z.string().describe('任务类型'),
            payload: z.record(z.string(), z.unknown()).describe('任务数据'),
            priority: z.enum([TASK_PRIORITY.LOW, TASK_PRIORITY.NORMAL, TASK_PRIORITY.HIGH, TASK_PRIORITY.CRITICAL]).optional().describe('优先级'),
        }, async ({ targetPositionId, taskType, payload, priority }) => {
            const task = await positionManager.enqueueTask(targetPositionId, {
                sourcePositionId: ORG_ARCHITECT_ID,
                targetPositionId,
                type: taskType,
                payload,
                priority: priority ?? TASK_PRIORITY.NORMAL,
            });
            return { content: [mcpText(`Task '${task.id}' dispatched to '${targetPositionId}'.`)] };
        }),
    ];
    return createSdkMcpServer({
        name: MCP_ADMIN_SERVER_NAME,
        version: CONFIG_VERSION,
        tools,
    });
}
//# sourceMappingURL=admin-tools.js.map