import { describe, it, expect } from 'vitest';
import {
  findLeafNodes,
  findNextLeaf,
  buildTrailingTodoItems,
  buildBranchPath,
  computeTreeSummary,
} from '../../src/domain/workflow/navigator.js';
import type { WorkflowNode } from '../../src/domain/workflow/types.js';

function makeNode(
  id: string,
  type: WorkflowNode['type'] = 'atomic',
  status: WorkflowNode['status'] = 'pending',
  children?: WorkflowNode[],
): WorkflowNode {
  return {
    id,
    type,
    name: id,
    description: `${id} desc`,
    status,
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    children,
  };
}

describe('findLeafNodes', () => {
  it('returns single atomic root as leaf', () => {
    const root = makeNode('root');
    expect(findLeafNodes(root)).toHaveLength(1);
  });

  it('returns atomic children as leaves', () => {
    const root = makeNode('root', 'composite', 'pending', [
      makeNode('a'),
      makeNode('b'),
    ]);
    expect(findLeafNodes(root)).toHaveLength(2);
  });

  it('returns unexpanded composite as leaf', () => {
    const root = makeNode('root', 'composite', 'pending', [
      makeNode('expanded', 'composite', 'pending', [makeNode('child')]),
      makeNode('unexpanded', 'composite', 'pending'),
    ]);
    const ids = findLeafNodes(root).map((l) => l.id);
    expect(ids).toContain('child');
    expect(ids).toContain('unexpanded');
  });
});

describe('findNextLeaf', () => {
  it('returns first pending atomic as leaf', () => {
    const root = makeNode('root', 'composite', 'pending', [
      makeNode('a', 'atomic', 'completed'),
      makeNode('b', 'atomic', 'pending'),
      makeNode('c', 'atomic', 'pending'),
    ]);
    const result = findNextLeaf(root);
    expect(result.type).toBe('leaf');
    if (result.type === 'leaf') {
      expect(result.node.id).toBe('b');
    }
  });

  it('returns needs_expansion for unexpanded composite', () => {
    const root = makeNode('root', 'composite', 'pending', [
      makeNode('a', 'atomic', 'completed'),
      makeNode('b', 'composite', 'pending'),
    ]);
    const result = findNextLeaf(root);
    expect(result.type).toBe('needs_expansion');
    if (result.type === 'needs_expansion') {
      expect(result.nodeId).toBe('b');
    }
  });

  it('returns failed node as next leaf', () => {
    const root = makeNode('root', 'composite', 'pending', [
      makeNode('a', 'atomic', 'failed'),
    ]);
    const result = findNextLeaf(root);
    expect(result.type).toBe('leaf');
    if (result.type === 'leaf') {
      expect(result.node.id).toBe('a');
    }
  });

  it('returns all_done when everything is terminal', () => {
    const root = makeNode('root', 'composite', 'completed', [
      makeNode('a', 'atomic', 'completed'),
      makeNode('b', 'atomic', 'skipped'),
    ]);
    expect(findNextLeaf(root).type).toBe('all_done');
  });

  it('handles deep nesting', () => {
    let node = makeNode('leaf', 'atomic', 'pending');
    for (let i = 9; i >= 0; i--) {
      node = makeNode(`level-${i}`, 'composite', 'pending', [node]);
    }
    const result = findNextLeaf(node);
    expect(result.type).toBe('leaf');
    if (result.type === 'leaf') {
      expect(result.node.id).toBe('leaf');
    }
  });

  it('skips in_progress atomic nodes', () => {
    const root = makeNode('root', 'composite', 'pending', [
      makeNode('a', 'atomic', 'in_progress'),
      makeNode('b', 'atomic', 'pending'),
    ]);
    const result = findNextLeaf(root);
    expect(result.type).toBe('leaf');
    if (result.type === 'leaf') {
      expect(result.node.id).toBe('b');
    }
  });

  it('returns all_done when only in_progress atomics remain', () => {
    const root = makeNode('root', 'composite', 'pending', [
      makeNode('a', 'atomic', 'completed'),
      makeNode('b', 'atomic', 'in_progress'),
    ]);
    const result = findNextLeaf(root);
    expect(result.type).toBe('all_done');
  });

  it('handles mixed status tree', () => {
    const root = makeNode('root', 'composite', 'pending', [
      makeNode('a', 'atomic', 'completed'),
      makeNode('b', 'atomic', 'skipped'),
      makeNode('c', 'atomic', 'failed'),
      makeNode('d', 'atomic', 'pending'),
    ]);
    const result = findNextLeaf(root);
    expect(result.type).toBe('leaf');
    if (result.type === 'leaf') {
      expect(result.node.id).toBe('c');
    }
  });
});

describe('buildTrailingTodoItems', () => {
  it('returns exactly three items', () => {
    const items = buildTrailingTodoItems();
    expect(items).toHaveLength(3);
  });

  it('marks all as mandatory trailing', () => {
    const items = buildTrailingTodoItems();
    expect(items.every((i) => i.isMandatoryTrailing)).toBe(true);
  });

  it('has correct subjects', () => {
    const items = buildTrailingTodoItems();
    expect(items[0].subject).toBe('Incremental tree mutation');
    expect(items[1].subject).toBe('Rule feedback');
    expect(items[2].subject).toBe('State transition');
  });

  it('all items start as pending', () => {
    const items = buildTrailingTodoItems();
    expect(items.every((i) => i.status === 'pending')).toBe(true);
  });
});

describe('buildBranchPath', () => {
  it('returns empty array for root node', () => {
    const root = makeNode('root', 'composite', 'pending', [makeNode('a')]);
    expect(buildBranchPath(root, 'root')).toEqual([]);
  });

  it('returns [root] for direct child', () => {
    const root = makeNode('root', 'composite', 'pending', [makeNode('a')]);
    expect(buildBranchPath(root, 'a')).toEqual(['root']);
  });

  it('returns full path for deeply nested node', () => {
    const root = makeNode('root', 'composite', 'pending', [
      makeNode('L1', 'composite', 'pending', [
        makeNode('L2', 'composite', 'pending', [
          makeNode('leaf'),
        ]),
      ]),
    ]);
    expect(buildBranchPath(root, 'leaf')).toEqual(['root', 'L1', 'L2']);
  });

  it('returns empty array when node not found', () => {
    const root = makeNode('root');
    expect(buildBranchPath(root, 'nonexistent')).toEqual([]);
  });
});

describe('computeTreeSummary', () => {
  it('computes summary for single node', () => {
    const root = makeNode('root');
    const summary = computeTreeSummary(root);
    expect(summary.totalNodes).toBe(1);
    expect(summary.leafNodes).toBe(1);
    expect(summary.completedLeaves).toBe(0);
    expect(summary.pendingLeaves).toBe(1);
    expect(summary.unexpandedComposites).toBe(0);
  });

  it('counts unexpanded composites', () => {
    const root = makeNode('root', 'composite', 'pending', [
      makeNode('a', 'atomic', 'completed'),
      makeNode('b', 'composite', 'pending'),
    ]);
    const summary = computeTreeSummary(root);
    expect(summary.totalNodes).toBe(3);
    expect(summary.unexpandedComposites).toBe(1);
  });

  it('computes mixed status tree summary', () => {
    const root = makeNode('root', 'composite', 'pending', [
      makeNode('a', 'atomic', 'completed'),
      makeNode('b', 'atomic', 'pending'),
      makeNode('c', 'atomic', 'failed'),
      makeNode('d', 'composite', 'pending', [
        makeNode('d1', 'atomic', 'completed'),
        makeNode('d2', 'atomic', 'pending'),
      ]),
    ]);
    const summary = computeTreeSummary(root);
    expect(summary.totalNodes).toBe(7);
    expect(summary.leafNodes).toBe(5);
    expect(summary.completedLeaves).toBe(2);
    expect(summary.pendingLeaves).toBe(2);
  });
});
