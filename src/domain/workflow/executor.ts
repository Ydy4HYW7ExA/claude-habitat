import type { WorkflowNode, NodeStatus } from './types.js';
import { ValidationError } from '../../infra/errors.js';

const VALID_TRANSITIONS: Record<NodeStatus, NodeStatus[]> = {
  pending: ['in_progress', 'skipped'],
  in_progress: ['completed', 'failed', 'pending'],
  completed: [],
  failed: ['pending', 'in_progress'],
  skipped: ['pending'],
};

export function canTransition(from: NodeStatus, to: NodeStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionNode(node: WorkflowNode, to: NodeStatus): void {
  if (!canTransition(node.status, to)) {
    throw new ValidationError(`Invalid transition: ${node.status} -> ${to}`, [`Cannot transition from ${node.status} to ${to}`]);
  }
  node.status = to;
  node.updatedAt = Date.now();
}

export function isTerminal(status: NodeStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'skipped';
}

export function allChildrenDone(node: WorkflowNode): boolean {
  if (!node.children) return true;
  return node.children.every((c) => isTerminal(c.status));
}
