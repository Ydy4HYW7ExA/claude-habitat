import { describe, it, expect } from 'vitest';
import { workflowChecks } from '../../src/domain/workflow/integrity.js';
import type { WorkflowTree, WorkflowNode } from '../../src/domain/workflow/types.js';

function makeNode(
  id: string,
  type: WorkflowNode['type'] = 'atomic',
  children?: WorkflowNode[],
): WorkflowNode {
  return {
    id,
    type,
    name: id,
    description: `${id} desc`,
    status: 'pending',
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    children,
  };
}

function makeTree(root: WorkflowNode): WorkflowTree {
  return {
    root,
    currentNode: null,
    depth: 0,
    maxDepth: 10,
    metadata: { createdAt: Date.now(), updatedAt: Date.now(), totalNodes: 1, completedNodes: 0 },
  };
}

describe('workflowChecks', () => {
  const [checkRoot, checkDuplicateIds, checkAtomicChildren, checkCompositeCompletion] = workflowChecks;

  describe('missing root check', () => {
    it('reports error when root is missing', () => {
      const tree = { root: null } as unknown as WorkflowTree;
      const issues = checkRoot(tree);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('error');
      expect(issues[0].category).toBe('root');
    });

    it('reports no issues for valid root', () => {
      const tree = makeTree(makeNode('root'));
      const issues = checkRoot(tree);
      expect(issues).toHaveLength(0);
    });
  });

  describe('duplicate ID check', () => {
    it('returns empty issues when root is null', () => {
      const tree = { root: null } as unknown as WorkflowTree;
      const issues = checkDuplicateIds(tree);
      expect(issues).toHaveLength(0);
    });

    it('reports error for duplicate IDs', () => {
      const root = makeNode('dup', 'composite', [makeNode('dup')]);
      const tree = makeTree(root);
      const issues = checkDuplicateIds(tree);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('error');
      expect(issues[0].category).toBe('id');
    });

    it('reports no issues for unique IDs', () => {
      const root = makeNode('root', 'composite', [makeNode('child-1'), makeNode('child-2')]);
      const tree = makeTree(root);
      const issues = checkDuplicateIds(tree);
      expect(issues).toHaveLength(0);
    });
  });

  describe('atomic children check', () => {
    it('returns empty issues when root is null', () => {
      const tree = { root: null } as unknown as WorkflowTree;
      const issues = checkAtomicChildren(tree);
      expect(issues).toHaveLength(0);
    });

    it('reports warning when atomic node has children', () => {
      const root = makeNode('root', 'atomic', [makeNode('child')]);
      const tree = makeTree(root);
      const issues = checkAtomicChildren(tree);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('warning');
      expect(issues[0].category).toBe('type');
    });

    it('reports no issues for atomic without children', () => {
      const tree = makeTree(makeNode('root'));
      const issues = checkAtomicChildren(tree);
      expect(issues).toHaveLength(0);
    });

    it('reports no issues for composite with children', () => {
      const root = makeNode('root', 'composite', [makeNode('child')]);
      const tree = makeTree(root);
      const issues = checkAtomicChildren(tree);
      expect(issues).toHaveLength(0);
    });
  });

  describe('composite completion check', () => {
    it('returns empty issues when root is null', () => {
      const tree = { root: null } as unknown as WorkflowTree;
      const issues = checkCompositeCompletion(tree);
      expect(issues).toHaveLength(0);
    });

    it('reports warning when all children terminal but composite not completed', () => {
      const child1 = makeNode('c1');
      child1.status = 'completed';
      const child2 = makeNode('c2');
      child2.status = 'completed';
      const root = makeNode('root', 'composite', [child1, child2]);
      // root is still 'pending'
      const tree = makeTree(root);
      const issues = checkCompositeCompletion(tree);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('warning');
      expect(issues[0].category).toBe('completion');
      expect(issues[0].repairable).toBe(true);
    });

    it('reports no issues when composite is also completed', () => {
      const child = makeNode('c1');
      child.status = 'completed';
      const root = makeNode('root', 'composite', [child]);
      root.status = 'completed';
      const tree = makeTree(root);
      const issues = checkCompositeCompletion(tree);
      expect(issues).toHaveLength(0);
    });

    it('reports no issues when children are not all terminal', () => {
      const root = makeNode('root', 'composite', [makeNode('c1'), makeNode('c2')]);
      const tree = makeTree(root);
      const issues = checkCompositeCompletion(tree);
      expect(issues).toHaveLength(0);
    });
  });
});
