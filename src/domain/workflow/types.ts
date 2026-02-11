export type NodeType = 'atomic' | 'composite';
export type NodeStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

import type { TreeNode } from '../../infra/tree.js';

export interface WorkflowNode extends TreeNode {
  id: string;
  type: NodeType;
  name: string;
  description: string;
  status: NodeStatus;
  children?: WorkflowNode[];
  metadata: Record<string, unknown>;
  parentId?: string;
  /** Unix epoch ms — workflows use numeric timestamps for efficient comparison and sorting */
  createdAt: number;
  /** Unix epoch ms — workflows use numeric timestamps for efficient comparison and sorting */
  updatedAt: number;
}

export interface WorkflowTree {
  root: WorkflowNode;
  currentNode: WorkflowNode | null;
  depth: number;
  maxDepth: number;
  metadata: {
    createdAt: number;
    updatedAt: number;
    totalNodes: number;
    completedNodes: number;
  };
}

/** @deprecated Legacy frame model — retained for store type compatibility. Use WorkflowExecutionState instead. */
export interface ExecutionFrame {
  node: WorkflowNode;
  state: unknown;
  childIndex: number;
  returnValue?: unknown;
}

/** @deprecated Legacy execution state — retained for store type compatibility. Use WorkflowExecutionState instead. */
export interface ExecutionState {
  frames: ExecutionFrame[];
  timestamp: number;
  version: string;
}

/** TodoList item (MCP-side tracking) */
export interface TodoItem {
  subject: string;
  description: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
  isMandatoryTrailing?: boolean;
  parallelizable?: boolean;
}

/** Work tree cursor */
export interface WorkflowCursor {
  currentLeafId: string | null;
  leafHistory: string[];
  branchPath: string[];
}

/** Enhanced execution state (replaces unused frames model) */
export interface WorkflowExecutionState {
  cursor: WorkflowCursor;
  timestamp: number;
  version: string;
}

/** Tree summary statistics */
export interface TreeSummary {
  totalNodes: number;
  leafNodes: number;
  completedLeaves: number;
  pendingLeaves: number;
  unexpandedComposites: number;
}

/** Transition result from navigator */
export type NextLeafResult =
  | { type: 'leaf'; node: WorkflowNode }
  | { type: 'needs_expansion'; nodeId: string }
  | { type: 'all_done' };

/** Transition action returned by service */
export type TransitionAction =
  | { action: 'activate_leaf'; nodeId: string; node: WorkflowNode; todoItems: TodoItem[]; treeSummary: TreeSummary; treeVisualization: string; branchPath: string[] }
  | { action: 'expand_composite'; nodeId: string; treeSummary: TreeSummary; treeVisualization: string }
  | { action: 'workflow_complete'; treeSummary: TreeSummary; treeVisualization: string };

/** Tree update operation */
export type TreeUpdateOp =
  | { op: 'add'; parentId: string; node: Record<string, unknown> }
  | { op: 'remove'; nodeId: string }
  | { op: 'modify'; nodeId: string; updates: Partial<Pick<WorkflowNode, 'name' | 'description' | 'status'>> };
