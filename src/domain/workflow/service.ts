import { randomBytes } from 'node:crypto';
import type { JsonStore } from '../../infra/json-store.js';
import type { Logger } from '../../logging/logger.js';
import type { HabitatConfig } from '../config/types.js';
import type {
  WorkflowTree, WorkflowNode, NodeStatus, ExecutionState,
  WorkflowExecutionState, WorkflowCursor,
  TransitionAction, TreeUpdateOp, TreeSummary,
} from './types.js';
import { validate } from '../../infra/validator.js';
import { createWorkflowSchema } from './schemas.js';
import { countNodes, findById, collectNodes } from '../../infra/tree.js';
import { NotFoundError, ValidationError } from '../../infra/errors.js';
import { canTransition, transitionNode, allChildrenDone, isTerminal } from './executor.js';
import { findNextLeaf, buildTrailingTodoItems, computeTreeSummary, buildBranchPath } from './navigator.js';
import { renderTree } from './visualizer.js';

function generateId(prefix: string): string {
  return `${prefix}-${randomBytes(8).toString('hex')}`;
}

export class WorkflowService {
  constructor(
    private treeStore: JsonStore<{ version: string; timestamp: number; tree: WorkflowTree }>,
    private stateStore: JsonStore<ExecutionState>,
    private logger: Logger,
    private config?: HabitatConfig['workflows'],
  ) {}

  private buildNode(
    input: Record<string, unknown>,
    parentId?: string,
    depth = 0,
    maxDepth = 10,
  ): WorkflowNode {
    if (depth > maxDepth) {
      throw new ValidationError('Max depth exceeded', [`Depth ${depth} exceeds max ${maxDepth}`]);
    }
    const now = Date.now();
    const node: WorkflowNode = {
      id: (input.id as string) || generateId('node'),
      type: input.type as WorkflowNode['type'],
      name: input.name as string,
      description: input.description as string,
      status: (input.status as WorkflowNode['status']) ?? 'pending',
      metadata: (input.metadata as Record<string, unknown>) ?? {},
      parentId,
      createdAt: now,
      updatedAt: now,
    };
    if (input.children && Array.isArray(input.children)) {
      node.children = (input.children as Record<string, unknown>[]).map((c) =>
        this.buildNode(c, node.id, depth + 1, maxDepth),
      );
    }
    return node;
  }

  async create(input: {
    name: string;
    description: string;
    rootNode: Record<string, unknown>;
    maxDepth?: number;
  }): Promise<{ workflowId: string; tree: WorkflowTree }> {
    const errors = validate(
      { name: input.name, description: input.description, maxDepth: input.maxDepth },
      createWorkflowSchema,
    );
    if (errors.length > 0) throw new ValidationError('Invalid workflow', errors);

    const workflowId = generateId('workflow');
    const maxDepth = input.maxDepth ?? this.config?.maxDepth ?? 10;
    const root = this.buildNode(input.rootNode, undefined, 0, maxDepth);
    root.id = workflowId; // root ID matches workflow ID

    const total = countNodes(root);
    const completed = countNodes(root, (n) => n.status === 'completed');
    const now = Date.now();

    const tree: WorkflowTree = {
      root,
      currentNode: null,
      depth: 0,
      maxDepth,
      metadata: {
        createdAt: now,
        updatedAt: now,
        totalNodes: total,
        completedNodes: completed,
      },
    };

    await this.treeStore.save(workflowId, {
      version: '1.0.0',
      timestamp: now,
      tree,
    });

    this.logger.info('Workflow created', { workflowId });
    return { workflowId, tree };
  }

  async load(
    workflowId: string,
    includeState = false,
  ): Promise<{
    found: boolean;
    tree: WorkflowTree | null;
    state: ExecutionState | null;
    metadata?: Record<string, unknown>;
  }> {
    const data = await this.treeStore.load(workflowId);
    if (!data) return { found: false, tree: null, state: null };

    let state: ExecutionState | null = null;
    if (includeState) {
      state = await this.stateStore.load(workflowId);
    }

    const { tree } = data;
    return {
      found: true,
      tree,
      state,
      metadata: {
        totalNodes: tree.metadata.totalNodes,
        completedNodes: tree.metadata.completedNodes,
        createdAt: tree.metadata.createdAt,
        updatedAt: tree.metadata.updatedAt,
        depth: tree.depth,
        maxDepth: tree.maxDepth,
      },
    };
  }

  async expand(
    workflowId: string,
    nodeId: string,
    children: Record<string, unknown>[],
  ): Promise<{ childrenAdded: number; totalNodes: number }> {
    const data = await this.treeStore.load(workflowId);
    if (!data) throw new NotFoundError('Workflow', workflowId);

    const { tree } = data;
    const target = findById(tree.root, nodeId);
    if (!target) throw new NotFoundError('Node', nodeId);
    if (target.type !== 'composite') {
      throw new ValidationError('Invalid node type', ['Target node must be composite']);
    }

    if (!target.children) target.children = [];

    const now = Date.now();
    for (const childInput of children) {
      const child = this.buildNode(childInput, nodeId);
      target.children.push(child);
    }

    target.metadata.expanded = true;
    target.metadata.expandedAt = now;
    target.metadata.childCount = target.children.length;
    target.updatedAt = now;

    const total = countNodes(tree.root);
    tree.metadata.totalNodes = total;
    tree.metadata.updatedAt = now;

    await this.treeStore.save(workflowId, {
      version: '1.0.0',
      timestamp: now,
      tree,
    });

    this.logger.info('Workflow expanded', { workflowId, nodeId });
    return { childrenAdded: children.length, totalNodes: total };
  }

  async updateNodeStatus(
    workflowId: string,
    nodeId: string,
    status: NodeStatus,
  ): Promise<{ previousStatus: NodeStatus; newStatus: NodeStatus }> {
    const data = await this.treeStore.load(workflowId);
    if (!data) throw new NotFoundError('Workflow', workflowId);

    const { tree } = data;
    const target = findById(tree.root, nodeId);
    if (!target) throw new NotFoundError('Node', nodeId);

    const previousStatus = target.status;
    transitionNode(target, status);

    const now = Date.now();
    tree.metadata.completedNodes = countNodes(tree.root, (n) => n.status === 'completed');
    tree.metadata.updatedAt = now;

    await this.treeStore.save(workflowId, {
      version: '1.0.0',
      timestamp: now,
      tree,
    });

    this.logger.info('Node status updated', { workflowId, nodeId, previousStatus, newStatus: status });
    return { previousStatus, newStatus: status };
  }

  async getProgress(workflowId: string): Promise<{
    totalNodes: number;
    completedNodes: number;
    allDone: boolean;
  }> {
    const data = await this.treeStore.load(workflowId);
    if (!data) throw new NotFoundError('Workflow', workflowId);

    const { tree } = data;
    const totalNodes = countNodes(tree.root);
    const completedNodes = countNodes(tree.root, (n) => isTerminal(n.status));

    return {
      totalNodes,
      completedNodes,
      allDone: allChildrenDone(tree.root),
    };
  }

  // ── Phase 3: New methods ──────────────────────────────────

  private async loadExecutionState(workflowId: string): Promise<WorkflowExecutionState | null> {
    const raw = await this.stateStore.load(workflowId);
    if (!raw) return null;
    return raw as unknown as WorkflowExecutionState;
  }

  private propagateCompletion(root: WorkflowNode): void {
    if (!root.children) return;
    for (const child of root.children) {
      this.propagateCompletion(child);
    }
    if (root.type === 'composite' && root.children.length > 0) {
      if (root.children.every((c) => isTerminal(c.status)) && !isTerminal(root.status)) {
        root.status = 'completed';
        root.updatedAt = Date.now();
      }
    }
  }

  async initializeCursor(workflowId: string): Promise<WorkflowExecutionState> {
    const data = await this.treeStore.load(workflowId);
    if (!data) throw new NotFoundError('Workflow', workflowId);

    const now = Date.now();
    const state: WorkflowExecutionState = {
      cursor: {
        currentLeafId: null,
        leafHistory: [],
        branchPath: [],
      },
      timestamp: now,
      version: '3.0.0',
    };

    await this.stateStore.save(workflowId, state as unknown as ExecutionState);
    this.logger.info('Cursor initialized', { workflowId });
    return state;
  }

  async transition(workflowId: string): Promise<TransitionAction> {
    const data = await this.treeStore.load(workflowId);
    if (!data) throw new NotFoundError('Workflow', workflowId);

    const state = await this.loadExecutionState(workflowId);
    if (!state) throw new NotFoundError('ExecutionState', workflowId);

    const { tree } = data;

    // Complete current leaf if one is active
    if (state.cursor.currentLeafId) {
      const current = findById(tree.root, state.cursor.currentLeafId);
      if (current && !isTerminal(current.status)) {
        transitionNode(current, 'in_progress');
        transitionNode(current, 'completed');
      }
      state.cursor.leafHistory.push(state.cursor.currentLeafId);
    }

    // Propagate completion upward
    this.propagateCompletion(tree.root);

    // Find next leaf
    const next = findNextLeaf(tree.root);
    const treeSummary = computeTreeSummary(tree.root);
    const treeVisualization = renderTree(tree);

    const now = Date.now();
    let result: TransitionAction;

    switch (next.type) {
      case 'leaf': {
        state.cursor.currentLeafId = next.node.id;
        const branchPath = buildBranchPath(tree.root, next.node.id);
        state.cursor.branchPath = branchPath;
        const todoItems = buildTrailingTodoItems();
        result = {
          action: 'activate_leaf',
          nodeId: next.node.id,
          node: next.node,
          todoItems,
          treeSummary,
          treeVisualization,
          branchPath,
        };
        break;
      }
      case 'needs_expansion': {
        state.cursor.currentLeafId = null;
        state.cursor.branchPath = [];
        result = {
          action: 'expand_composite',
          nodeId: next.nodeId,
          treeSummary,
          treeVisualization,
        };
        break;
      }
      case 'all_done': {
        state.cursor.currentLeafId = null;
        state.cursor.branchPath = [];
        result = {
          action: 'workflow_complete',
          treeSummary,
          treeVisualization,
        };
        break;
      }
    }

    state.timestamp = now;
    tree.metadata.completedNodes = countNodes(
      tree.root, (n) => n.status === 'completed',
    );
    tree.metadata.totalNodes = countNodes(tree.root);
    tree.metadata.updatedAt = now;

    await this.treeStore.save(workflowId, {
      version: '1.0.0', timestamp: now, tree,
    });
    await this.stateStore.save(
      workflowId, state as unknown as ExecutionState,
    );

    this.logger.info('Transition', {
      workflowId, action: result.action,
    });
    return result;
  }
  async updateTree(
    workflowId: string,
    operations: TreeUpdateOp[],
  ): Promise<{ applied: number; totalNodes: number }> {
    const data = await this.treeStore.load(workflowId);
    if (!data) throw new NotFoundError('Workflow', workflowId);

    const { tree } = data;
    let applied = 0;

    for (const op of operations) {
      switch (op.op) {
        case 'add': {
          const parent = findById(tree.root, op.parentId);
          if (!parent) break;
          if (!parent.children) parent.children = [];
          parent.children.push(this.buildNode(op.node, op.parentId));
          applied++;
          break;
        }
        case 'remove': {
          const allNodes = collectNodes<WorkflowNode>(tree.root);
          for (const n of allNodes) {
            if (n.children) {
              const idx = n.children.findIndex((c) => c.id === op.nodeId);
              if (idx !== -1) { n.children.splice(idx, 1); applied++; break; }
            }
          }
          break;
        }
        case 'modify': {
          const target = findById(tree.root, op.nodeId);
          if (!target) break;
          if (op.updates.name !== undefined) target.name = op.updates.name;
          if (op.updates.description !== undefined) target.description = op.updates.description;
          if (op.updates.status !== undefined) transitionNode(target, op.updates.status);
          target.updatedAt = Date.now();
          applied++;
          break;
        }
      }
    }

    const now = Date.now();
    tree.metadata.totalNodes = countNodes(tree.root);
    tree.metadata.completedNodes = countNodes(tree.root, (n) => n.status === 'completed');
    tree.metadata.updatedAt = now;

    await this.treeStore.save(workflowId, { version: '1.0.0', timestamp: now, tree });
    this.logger.info('Tree updated', { workflowId, applied });
    return { applied, totalNodes: tree.metadata.totalNodes };
  }

  async getCursorState(workflowId: string): Promise<{
    cursor: WorkflowCursor;
    treeSummary: TreeSummary;
    treeVisualization: string;
    currentNode: WorkflowNode | null;
  }> {
    const data = await this.treeStore.load(workflowId);
    if (!data) throw new NotFoundError('Workflow', workflowId);

    const state = await this.loadExecutionState(workflowId);
    if (!state) throw new NotFoundError('ExecutionState', workflowId);

    const { tree } = data;
    const treeSummary = computeTreeSummary(tree.root);
    const treeVisualization = renderTree(tree);

    let currentNode: WorkflowNode | null = null;
    if (state.cursor.currentLeafId) {
      currentNode = findById(tree.root, state.cursor.currentLeafId);
    }

    return {
      cursor: state.cursor,
      treeSummary,
      treeVisualization,
      currentNode,
    };
  }

  async listActive(): Promise<string[]> {
    const allIds = await this.treeStore.list();
    const activeIds: string[] = [];

    for (const id of allIds) {
      const data = await this.treeStore.load(id);
      if (!data) continue;

      const summary = computeTreeSummary(data.tree.root);
      if (summary.pendingLeaves > 0 || summary.unexpandedComposites > 0) {
        activeIds.push(id);
      }
    }

    return activeIds;
  }
}