import type { WorkflowNode, TodoItem, TreeSummary, NextLeafResult } from './types.js';
import { collectNodes } from '../../infra/tree.js';
import { isTerminal } from './executor.js';

/**
 * Build the branch path (IDs from root to target node's parent) for a given node.
 * Returns empty array if nodeId is the root itself or not found.
 */
export function buildBranchPath(root: WorkflowNode, nodeId: string): string[] {
  const path: string[] = [];
  function dfs(node: WorkflowNode): boolean {
    if (node.id === nodeId) return true;
    if (node.children) {
      for (const child of node.children) {
        if (dfs(child)) {
          path.unshift(node.id);
          return true;
        }
      }
    }
    return false;
  }
  dfs(root);
  return path;
}

/**
 * Collect all leaf nodes (atomic nodes or composites without children).
 */
export function findLeafNodes(root: WorkflowNode): WorkflowNode[] {
  return collectNodes<WorkflowNode>(root, (n) => {
    if (n.type === 'atomic') return true;
    return !n.children || n.children.length === 0;
  });
}

/**
 * DFS to find the next executable leaf node.
 * - pending/failed atomic → return as leaf
 * - composite with no children (unexpanded) → needs_expansion
 * - all done → all_done
 */
export function findNextLeaf(root: WorkflowNode): NextLeafResult {
  function dfs(node: WorkflowNode): NextLeafResult | null {
    // failed atomics are retryable, so check before terminal skip
    if (node.type === 'atomic' && node.status === 'failed') {
      return { type: 'leaf', node };
    }
    if (isTerminal(node.status)) return null;

    if (node.type === 'atomic') {
      if (node.status === 'pending') {
        return { type: 'leaf', node };
      }
      return null;
    }

    // composite node
    if (!node.children || node.children.length === 0) {
      return { type: 'needs_expansion', nodeId: node.id };
    }

    for (const child of node.children) {
      const result = dfs(child);
      if (result) return result;
    }

    return null;
  }

  return dfs(root) ?? { type: 'all_done' };
}

/**
 * Build the three mandatory trailing TodoItems appended to every leaf's TodoList.
 */
export function buildTrailingTodoItems(): TodoItem[] {
  return [
    {
      subject: 'Incremental tree mutation',
      description:
        'Based on Part 1 results, perform incremental operations on the work tree. ' +
        'Use EnterPlanMode to explore context, then design tree mutations: ' +
        'add subtrees (composite + atomic nodes), remove obsolete nodes, modify descriptions. ' +
        'After ExitPlanMode, persist via habitat_doc_create, then apply via habitat_workflow_update_tree / habitat_workflow_expand. ' +
        'The goal is to refine the tree until the next executable leaf emerges. ' +
        'Skip if no structural changes are needed.',
      activeForm: 'Mutating work tree',
      status: 'pending',
      isMandatoryTrailing: true,
    },
    {
      subject: 'Rule feedback',
      description:
        'Call habitat_session_stats({ format: "markdown" }) to review rule activity. ' +
        'Create or update rules if gaps are found. Skip if stats show normal activity.',
      activeForm: 'Reviewing rule feedback',
      status: 'pending',
      isMandatoryTrailing: true,
    },
    {
      subject: 'State transition',
      description:
        'Call habitat_workflow_transition to complete this leaf. ' +
        'Handle the returned action: activate_leaf → proceed to next leaf, ' +
        'expand_composite → execute the habitat_workflow_expand already designed, then transition again, ' +
        'workflow_complete → summarize results.',
      activeForm: 'Transitioning state',
      status: 'pending',
      isMandatoryTrailing: true,
    },
  ];
}

/**
 * Compute summary statistics for the tree.
 */
export function computeTreeSummary(root: WorkflowNode): TreeSummary {
  const allNodes = collectNodes<WorkflowNode>(root);
  const leaves = findLeafNodes(root);

  const completedLeaves = leaves.filter((n) => n.status === 'completed').length;
  const pendingLeaves = leaves.filter((n) => !isTerminal(n.status)).length;

  const unexpandedComposites = allNodes.filter(
    (n) => n.type === 'composite' && (!n.children || n.children.length === 0) && !isTerminal(n.status),
  ).length;

  return {
    totalNodes: allNodes.length,
    leafNodes: leaves.length,
    completedLeaves,
    pendingLeaves,
    unexpandedComposites,
  };
}
