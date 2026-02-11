import { describe, it, expect } from 'vitest';
import { canTransition, transitionNode, isTerminal, allChildrenDone } from '../../src/domain/workflow/executor.js';
import type { WorkflowNode, NodeStatus } from '../../src/domain/workflow/types.js';

function makeNode(status: NodeStatus = 'pending', children?: WorkflowNode[]): WorkflowNode {
  return {
    id: 'test-node',
    type: children ? 'composite' : 'atomic',
    name: 'Test',
    description: 'Test node',
    status,
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    children,
  };
}

describe('canTransition', () => {
  it('allows pending -> in_progress', () => {
    expect(canTransition('pending', 'in_progress')).toBe(true);
  });

  it('allows pending -> skipped', () => {
    expect(canTransition('pending', 'skipped')).toBe(true);
  });

  it('allows in_progress -> completed', () => {
    expect(canTransition('in_progress', 'completed')).toBe(true);
  });

  it('allows in_progress -> failed', () => {
    expect(canTransition('in_progress', 'failed')).toBe(true);
  });

  it('allows in_progress -> pending', () => {
    expect(canTransition('in_progress', 'pending')).toBe(true);
  });

  it('allows failed -> pending', () => {
    expect(canTransition('failed', 'pending')).toBe(true);
  });

  it('allows failed -> in_progress', () => {
    expect(canTransition('failed', 'in_progress')).toBe(true);
  });

  it('allows skipped -> pending', () => {
    expect(canTransition('skipped', 'pending')).toBe(true);
  });

  it('disallows completed -> any', () => {
    expect(canTransition('completed', 'pending')).toBe(false);
    expect(canTransition('completed', 'in_progress')).toBe(false);
    expect(canTransition('completed', 'failed')).toBe(false);
    expect(canTransition('completed', 'skipped')).toBe(false);
  });

  it('disallows pending -> completed', () => {
    expect(canTransition('pending', 'completed')).toBe(false);
  });

  it('disallows pending -> failed', () => {
    expect(canTransition('pending', 'failed')).toBe(false);
  });

  it('returns false for unknown status', () => {
    expect(canTransition('unknown' as any, 'pending')).toBe(false);
  });
});

describe('transitionNode', () => {
  it('transitions node and updates timestamp', () => {
    const node = makeNode('pending');
    const before = node.updatedAt;
    transitionNode(node, 'in_progress');
    expect(node.status).toBe('in_progress');
    expect(node.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('throws ValidationError on invalid transition', () => {
    const node = makeNode('completed');
    expect(() => transitionNode(node, 'in_progress')).toThrow('Invalid transition');
  });
});

describe('isTerminal', () => {
  it('returns true for completed', () => {
    expect(isTerminal('completed')).toBe(true);
  });

  it('returns true for failed', () => {
    expect(isTerminal('failed')).toBe(true);
  });

  it('returns true for skipped', () => {
    expect(isTerminal('skipped')).toBe(true);
  });

  it('returns false for pending', () => {
    expect(isTerminal('pending')).toBe(false);
  });

  it('returns false for in_progress', () => {
    expect(isTerminal('in_progress')).toBe(false);
  });
});

describe('allChildrenDone', () => {
  it('returns true for node without children', () => {
    expect(allChildrenDone(makeNode('pending'))).toBe(true);
  });

  it('returns true when all children are terminal', () => {
    const node = makeNode('in_progress', [
      makeNode('completed'),
      makeNode('failed'),
      makeNode('skipped'),
    ]);
    expect(allChildrenDone(node)).toBe(true);
  });

  it('returns false when some children are not terminal', () => {
    const node = makeNode('in_progress', [
      makeNode('completed'),
      makeNode('pending'),
    ]);
    expect(allChildrenDone(node)).toBe(false);
  });
});
