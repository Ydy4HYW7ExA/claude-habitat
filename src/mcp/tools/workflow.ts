import type { Container } from '../../di/container.js';
import type { NodeStatus, TreeUpdateOp } from '../../domain/workflow/types.js';
import { Tokens } from '../../di/tokens.js';
import { defineTool, type ToolMetadata } from '../define-tool.js';

export function registerWorkflowTools(container: Container): ToolMetadata[] {
  const svc = container.resolve(Tokens.WorkflowService);

  return [
    defineTool({
      name: 'habitat_workflow_create',
      description: 'Creates a new workflow.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          rootNode: { type: 'object' },
          maxDepth: { type: 'number' },
        },
        required: ['name', 'description', 'rootNode'],
      },
      async handler(input: {
        name: string;
        description: string;
        rootNode: Record<string, unknown>;
        maxDepth?: number;
      }) {
        const result = await svc.create(input);
        return {
          workflowId: result.workflowId,
          message: `Workflow created with ${result.tree.metadata.totalNodes} nodes`,
        };
      },
    }),

    defineTool({
      name: 'habitat_workflow_load',
      description: 'Load a workflow tree from storage.',
      schema: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          includeState: { type: 'boolean' },
        },
        required: ['workflowId'],
      },
      async handler(input: { workflowId: string; includeState?: boolean }) {
        return svc.load(input.workflowId, input.includeState ?? false);
      },
    }),

    defineTool({
      name: 'habitat_workflow_expand',
      description: 'Expands a composite node by adding child nodes.',
      schema: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          nodeId: { type: 'string' },
          children: { type: 'array', items: { type: 'object' } },
        },
        required: ['workflowId', 'nodeId', 'children'],
      },
      async handler(input: {
        workflowId: string;
        nodeId: string;
        children: Record<string, unknown>[];
      }) {
        const result = await svc.expand(
          input.workflowId,
          input.nodeId,
          input.children,
        );
        return {
          nodeId: input.nodeId,
          ...result,
        };
      },
    }),

    defineTool({
      name: 'habitat_workflow_update_status',
      description: 'Update the status of a single workflow node.',
      schema: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          nodeId: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['workflowId', 'nodeId', 'status'],
      },
      async handler(input: {
        workflowId: string;
        nodeId: string;
        status: string;
      }) {
        const result = await svc.updateNodeStatus(
          input.workflowId,
          input.nodeId,
          input.status as NodeStatus,
        );
        return result;
      },
    }),

    defineTool({
      name: 'habitat_workflow_get_progress',
      description: 'Get progress summary for a workflow.',
      schema: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
        },
        required: ['workflowId'],
      },
      async handler(input: { workflowId: string }) {
        return svc.getProgress(input.workflowId);
      },
    }),

    defineTool({
      name: 'habitat_workflow_init_cursor',
      description: 'Initialize execution cursor for a workflow.',
      schema: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
        },
        required: ['workflowId'],
      },
      async handler(input: { workflowId: string }) {
        return svc.initializeCursor(input.workflowId);
      },
    }),

    defineTool({
      name: 'habitat_workflow_status',
      description: 'Session resume helper. Returns active workflow status.',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      async handler() {
        const activeIds = await svc.listActive();
        if (activeIds.length === 0) return { hasActiveWorkflow: false };
        const wfId = activeIds[0];
        const cursorState = await svc.getCursorState(wfId);
        return { hasActiveWorkflow: true, workflowId: wfId, ...cursorState };
      },
    }),

    defineTool({
      name: 'habitat_workflow_transition',
      description: 'Complete current leaf and transition to the next node.',
      schema: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
        },
        required: ['workflowId'],
      },
      async handler(input: { workflowId: string }) {
        return svc.transition(input.workflowId);
      },
    }),

    defineTool({
      name: 'habitat_workflow_update_tree',
      description: 'Batch update tree structure with add/remove/modify operations.',
      schema: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          operations: { type: 'array', items: { type: 'object' } },
        },
        required: ['workflowId', 'operations'],
      },
      async handler(input: {
        workflowId: string;
        operations: TreeUpdateOp[];
      }) {
        return svc.updateTree(input.workflowId, input.operations);
      },
    }),

    defineTool({
      name: 'habitat_workflow_cursor_state',
      description: 'Get current cursor position and context.',
      schema: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
        },
        required: ['workflowId'],
      },
      async handler(input: { workflowId: string }) {
        return svc.getCursorState(input.workflowId);
      },
    }),
  ];
}