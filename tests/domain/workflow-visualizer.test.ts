import { describe, it, expect } from 'vitest';
import { renderTree, renderProgress, renderCursorContext } from '../../src/domain/workflow/visualizer.js';
import type { WorkflowTree, WorkflowNode } from '../../src/domain/workflow/types.js';

function makeNode(
  name: string,
  status: WorkflowNode['status'] = 'pending',
  type: WorkflowNode['type'] = 'atomic',
  children?: WorkflowNode[],
): WorkflowNode {
  return {
    id: `node-${name}`,
    type,
    name,
    description: `${name} desc`,
    status,
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    children,
  };
}

function makeTree(root: WorkflowNode, totalNodes = 1, completedNodes = 0): WorkflowTree {
  return {
    root,
    currentNode: null,
    depth: 0,
    maxDepth: 10,
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalNodes,
      completedNodes,
    },
  };
}

describe('renderTree', () => {
  it('renders a single atomic node', () => {
    const tree = makeTree(makeNode('Root'));
    const result = renderTree(tree);
    expect(result).toBe('[ ] - Root');
  });

  it('renders unknown status with default icon', () => {
    const node = makeNode('Root', 'unknown' as any);
    const tree = makeTree(node);
    const result = renderTree(tree);
    expect(result).toBe('[ ] - Root');
  });

  it('renders a composite with children', () => {
    const root = makeNode('Root', 'pending', 'composite', [
      makeNode('Step 1', 'completed'),
      makeNode('Step 2', 'in_progress'),
      makeNode('Step 3', 'pending'),
    ]);
    const tree = makeTree(root, 4, 1);
    const result = renderTree(tree);
    expect(result).toContain('[ ] + Root');
    expect(result).toContain('  [x] - Step 1');
    expect(result).toContain('  [>] - Step 2');
    expect(result).toContain('  [ ] - Step 3');
  });

  it('renders nested tree structure', () => {
    const root = makeNode('Root', 'pending', 'composite', [
      makeNode('Phase 1', 'pending', 'composite', [
        makeNode('Task A', 'failed'),
        makeNode('Task B', 'skipped'),
      ]),
    ]);
    const tree = makeTree(root, 4, 0);
    const result = renderTree(tree);
    expect(result).toContain('[ ] + Root');
    expect(result).toContain('  [ ] + Phase 1');
    expect(result).toContain('    [!] - Task A');
    expect(result).toContain('    [-] - Task B');
  });
});

describe('renderProgress', () => {
  it('renders 0% for empty tree', () => {
    const tree = makeTree(makeNode('Root'), 1, 0);
    expect(renderProgress(tree)).toBe('Progress: 0/1 (0%)');
  });

  it('renders 50% progress', () => {
    const tree = makeTree(makeNode('Root'), 4, 2);
    expect(renderProgress(tree)).toBe('Progress: 2/4 (50%)');
  });

  it('renders 100% progress', () => {
    const tree = makeTree(makeNode('Root'), 3, 3);
    expect(renderProgress(tree)).toBe('Progress: 3/3 (100%)');
  });

  it('handles zero total nodes', () => {
    const tree = makeTree(makeNode('Root'), 0, 0);
    expect(renderProgress(tree)).toBe('Progress: 0/0 (0%)');
  });
});

describe('renderCursorContext', () => {
  it('renders cursor context with current leaf', () => {
    const root = makeNode('Root', 'pending', 'composite', [
      makeNode('Step 1', 'in_progress'),
      makeNode('Step 2', 'pending'),
    ]);
    const tree = makeTree(root, 3, 0);
    const cursor = { currentLeafId: 'node-Step 1', leafHistory: ['node-prev'] };
    const result = renderCursorContext(tree, cursor);

    expect(result).toContain('Current leaf: node-Step 1');
    expect(result).toContain('Completed leaves: 1');
    expect(result).toContain('Step 1');
    expect(result).toContain('Progress: 0/3 (0%)');
  });

  it('renders cursor context with no current leaf', () => {
    const tree = makeTree(makeNode('Root'), 1, 0);
    const cursor = { currentLeafId: null, leafHistory: [] };
    const result = renderCursorContext(tree, cursor);

    expect(result).toContain('Current leaf: (none)');
    expect(result).toContain('Completed leaves: 0');
  });
});
