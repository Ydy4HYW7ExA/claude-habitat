export interface TreeNode {
  children?: TreeNode[];
}

export interface VisitorCallbacks<T extends TreeNode> {
  enter?: (node: T, depth: number, parent?: T) => boolean | void;
  exit?: (node: T, depth: number, parent?: T) => void;
}

export function traverse<T extends TreeNode>(
  root: T,
  visitor: VisitorCallbacks<T>,
  maxDepth = Infinity,
): void {
  function walk(node: T, depth: number, parent?: T): void {
    if (depth > maxDepth) return;
    const skip = visitor.enter?.(node, depth, parent);
    if (skip === false) return;
    if (node.children) {
      for (const child of node.children) {
        walk(child as T, depth + 1, node);
      }
    }
    visitor.exit?.(node, depth, parent);
  }
  walk(root, 0);
}

export function findNode<T extends TreeNode>(
  root: T,
  pred: (node: T) => boolean,
): T | null {
  if (pred(root)) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNode(child as T, pred);
      if (found) return found;
    }
  }
  return null;
}

export function findById<T extends TreeNode & { id: string }>(
  root: T,
  id: string,
): T | null {
  return findNode(root, (n) => n.id === id);
}

export function collectNodes<T extends TreeNode>(
  root: T,
  pred?: (node: T) => boolean,
): T[] {
  const result: T[] = [];
  traverse(root, {
    enter(node) {
      if (!pred || pred(node)) result.push(node);
    },
  });
  return result;
}

export function countNodes<T extends TreeNode>(
  root: T,
  pred?: (node: T) => boolean,
): number {
  let count = 0;
  traverse(root, {
    enter(node) {
      if (!pred || pred(node)) count++;
    },
  });
  return count;
}
