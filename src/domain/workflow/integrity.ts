import type { Check, Issue } from '../../infra/integrity.js';
import type { WorkflowTree, WorkflowNode } from './types.js';
import { collectNodes } from '../../infra/tree.js';
import { isTerminal } from './executor.js';

export const workflowChecks: Check<WorkflowTree>[] = [
  (tree) => {
    const issues: Issue[] = [];
    if (!tree.root) {
      issues.push({ severity: 'error', category: 'root', message: 'Missing root node', repairable: false });
    }
    return issues;
  },

  (tree) => {
    const issues: Issue[] = [];
    if (!tree.root) return issues;
    const nodes = collectNodes<WorkflowNode>(tree.root);
    const ids = new Set<string>();
    for (const n of nodes) {
      if (ids.has(n.id)) {
        issues.push({
          severity: 'error', category: 'id',
          message: `Duplicate node ID: ${n.id}`,
          entityId: n.id, repairable: false,
        });
      }
      ids.add(n.id);
    }
    return issues;
  },

  (tree) => {
    const issues: Issue[] = [];
    if (!tree.root) return issues;
    const nodes = collectNodes<WorkflowNode>(tree.root);
    for (const n of nodes) {
      if (n.type === 'atomic' && n.children && n.children.length > 0) {
        issues.push({
          severity: 'warning', category: 'type',
          message: `Atomic node ${n.id} has children`,
          entityId: n.id, repairable: false,
        });
      }
    }
    return issues;
  },

  (tree) => {
    const issues: Issue[] = [];
    if (!tree.root) return issues;
    const nodes = collectNodes<WorkflowNode>(tree.root);
    for (const n of nodes) {
      if (n.type === 'composite' && n.children && n.children.length > 0) {
        const allDone = n.children.every((c) => isTerminal(c.status));
        if (allDone && !isTerminal(n.status)) {
          issues.push({
            severity: 'warning',
            category: 'completion',
            message: `Composite node ${n.id} has all children done but is not completed`,
            entityId: n.id,
            repairable: true,
          });
        }
      }
    }
    return issues;
  },
];
