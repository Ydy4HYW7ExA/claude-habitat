import type { WorkflowNode, WorkflowTree, WorkflowCursor } from './types.js';
import { traverse } from '../../infra/tree.js';

const STATUS_ICONS: Record<string, string> = {
  pending: '[ ]',
  in_progress: '[>]',
  completed: '[x]',
  failed: '[!]',
  skipped: '[-]',
};

export function renderTree(tree: WorkflowTree, cursorNodeId?: string): string {
  const lines: string[] = [];
  traverse(tree.root, {
    enter(node: WorkflowNode, depth: number) {
      const indent = '  '.repeat(depth);
      const icon = STATUS_ICONS[node.status] ?? '[ ]';
      const type = node.type === 'composite' ? '+' : '-';
      const cursor = cursorNodeId === node.id ? '>>> ' : '';
      lines.push(`${cursor}${indent}${icon} ${type} ${node.name}`);
    },
  });
  return lines.join('\n');
}

export function renderProgress(tree: WorkflowTree): string {
  const { totalNodes, completedNodes } = tree.metadata;
  const pct = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;
  return `Progress: ${completedNodes}/${totalNodes} (${pct}%)`;
}

export function renderCursorContext(tree: WorkflowTree, cursor: WorkflowCursor): string {
  const lines: string[] = [];
  lines.push(`Current leaf: ${cursor.currentLeafId ?? '(none)'}`);
  lines.push(`Completed leaves: ${cursor.leafHistory.length}`);
  lines.push('');
  lines.push(renderTree(tree, cursor.currentLeafId ?? undefined));
  lines.push('');
  lines.push(renderProgress(tree));
  return lines.join('\n');
}
