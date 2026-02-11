import { describe, it, expect } from 'vitest';
import { traverse, findNode, findById, collectNodes, countNodes } from '../../src/infra/tree.js';

interface TestNode {
  id: string;
  children?: TestNode[];
  [key: string]: unknown;
}

const tree: TestNode = {
  id: 'root',
  children: [
    { id: 'a', children: [{ id: 'a1' }, { id: 'a2' }] },
    { id: 'b', children: [{ id: 'b1' }] },
  ],
};

describe('Tree', () => {
  describe('traverse', () => {
    it('visits all nodes', () => {
      const visited: string[] = [];
      traverse(tree, { enter: (n) => { visited.push(n.id); } });
      expect(visited).toEqual(['root', 'a', 'a1', 'a2', 'b', 'b1']);
    });

    it('respects maxDepth', () => {
      const visited: string[] = [];
      traverse(tree, { enter: (n) => { visited.push(n.id); } }, 1);
      expect(visited).toEqual(['root', 'a', 'b']);
    });

    it('skips subtree when enter returns false', () => {
      const visited: string[] = [];
      traverse(tree, {
        enter: (n) => {
          visited.push(n.id);
          if (n.id === 'a') return false;
        },
      });
      expect(visited).toEqual(['root', 'a', 'b', 'b1']);
    });

    it('calls exit callback', () => {
      const exited: string[] = [];
      traverse(tree, { exit: (n) => { exited.push(n.id); } });
      expect(exited).toEqual(['a1', 'a2', 'a', 'b1', 'b', 'root']);
    });
  });

  describe('findNode', () => {
    it('finds a node by predicate', () => {
      const node = findNode(tree, (n) => n.id === 'a2');
      expect(node?.id).toBe('a2');
    });

    it('returns null when not found', () => {
      expect(findNode(tree, (n) => n.id === 'z')).toBeNull();
    });

    it('finds root', () => {
      expect(findNode(tree, (n) => n.id === 'root')?.id).toBe('root');
    });
  });

  describe('findById', () => {
    it('finds by id', () => {
      expect(findById(tree, 'b1')?.id).toBe('b1');
    });

    it('returns null for missing id', () => {
      expect(findById(tree, 'missing')).toBeNull();
    });
  });

  describe('collectNodes', () => {
    it('collects all nodes', () => {
      const ids = collectNodes(tree).map((n) => n.id);
      expect(ids).toEqual(['root', 'a', 'a1', 'a2', 'b', 'b1']);
    });

    it('collects with predicate', () => {
      const leaves = collectNodes(tree, (n) => !n.children || n.children.length === 0);
      expect(leaves.map((n) => n.id)).toEqual(['a1', 'a2', 'b1']);
    });
  });

  describe('countNodes', () => {
    it('counts all nodes', () => {
      expect(countNodes(tree)).toBe(6);
    });

    it('counts with predicate', () => {
      expect(countNodes(tree, (n) => n.id.startsWith('a'))).toBe(3);
    });
  });
});
