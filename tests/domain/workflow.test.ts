import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkflowService } from '../../src/domain/workflow/service.js';
import { JsonStore } from '../../src/infra/json-store.js';
import { Logger } from '../../src/logging/logger.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('WorkflowService', () => {
  let dir: string;
  let service: WorkflowService;

  beforeEach(async () => {
    dir = join(tmpdir(), `wf-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(dir, { recursive: true });
    const treeDir = join(dir, 'trees');
    const stateDir = join(dir, 'states');
    const treeStore = new JsonStore<any>(treeDir);
    const stateStore = new JsonStore<any>(stateDir);
    await treeStore.ensureDir();
    await stateStore.ensureDir();
    const logger = new Logger({ level: 'error' });
    service = new WorkflowService(treeStore, stateStore, logger, { maxDepth: 10 });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('creates a workflow with atomic root', async () => {
      const result = await service.create({
        name: 'Test WF',
        description: 'A test workflow',
        rootNode: { type: 'atomic', name: 'Root', description: 'Root node' },
      });
      expect(result.workflowId).toMatch(/^workflow-/);
      expect(result.tree.root.name).toBe('Root');
      expect(result.tree.metadata.totalNodes).toBe(1);
    });

    it('creates a workflow with composite root and children', async () => {
      const result = await service.create({
        name: 'Composite WF',
        description: 'Has children',
        rootNode: {
          type: 'composite', name: 'Root', description: 'Root',
          children: [
            { type: 'atomic', name: 'Step 1', description: 'First', status: 'pending', metadata: {} },
            { type: 'atomic', name: 'Step 2', description: 'Second', status: 'pending', metadata: {} },
          ],
        },
      });
      expect(result.tree.root.children).toHaveLength(2);
      expect(result.tree.metadata.totalNodes).toBe(3);
    });

    it('rejects invalid input', async () => {
      await expect(
        service.create({ name: '', description: 'x', rootNode: { type: 'atomic', name: 'R', description: 'r' } }),
      ).rejects.toThrow();
    });
  });

  describe('load', () => {
    it('loads an existing workflow', async () => {
      const { workflowId } = await service.create({
        name: 'Load Test', description: 'For loading',
        rootNode: { type: 'atomic', name: 'R', description: 'r' },
      });
      const result = await service.load(workflowId);
      expect(result.found).toBe(true);
      expect(result.tree?.root.name).toBe('R');
    });

    it('returns not found for missing workflow', async () => {
      const result = await service.load('workflow-nonexistent');
      expect(result.found).toBe(false);
    });
  });

  describe('expand', () => {
    it('throws for missing workflow', async () => {
      await expect(
        service.expand('workflow-nope', 'node-1', []),
      ).rejects.toThrow('not found');
    });

    it('throws for missing node', async () => {
      const { workflowId } = await service.create({
        name: 'No Node', description: 'node missing',
        rootNode: { type: 'composite', name: 'Root', description: 'root' },
      });
      await expect(
        service.expand(workflowId, 'nonexistent', []),
      ).rejects.toThrow('not found');
    });

    it('expands a composite node', async () => {
      const { workflowId, tree } = await service.create({
        name: 'Expand Test', description: 'For expanding',
        rootNode: { type: 'composite', name: 'Root', description: 'root' },
      });
      const result = await service.expand(workflowId, tree.root.id, [
        { id: 'child-1', type: 'atomic', name: 'C1', description: 'c1', status: 'pending', metadata: {} },
        { id: 'child-2', type: 'atomic', name: 'C2', description: 'c2', status: 'pending', metadata: {} },
      ]);
      expect(result.childrenAdded).toBe(2);
      expect(result.totalNodes).toBe(3);
    });

    it('throws for atomic node', async () => {
      const { workflowId, tree } = await service.create({
        name: 'Atomic Test', description: 'Cannot expand atomic',
        rootNode: { type: 'atomic', name: 'Root', description: 'root' },
      });
      await expect(
        service.expand(workflowId, tree.root.id, [
          { id: 'c', type: 'atomic', name: 'C', description: 'c', status: 'pending', metadata: {} },
        ]),
      ).rejects.toThrow('Invalid node type');
    });
  });

  describe('updateNodeStatus', () => {
    it('throws for missing workflow', async () => {
      await expect(
        service.updateNodeStatus('workflow-nope', 'node-1', 'in_progress'),
      ).rejects.toThrow('not found');
    });

    it('throws for missing node', async () => {
      const { workflowId } = await service.create({
        name: 'Missing Node', description: 'node missing',
        rootNode: { type: 'atomic', name: 'R', description: 'r' },
      });
      await expect(
        service.updateNodeStatus(workflowId, 'nonexistent', 'in_progress'),
      ).rejects.toThrow('not found');
    });

    it('transitions a node from pending to in_progress', async () => {
      const { workflowId, tree } = await service.create({
        name: 'Status Test', description: 'For status updates',
        rootNode: { type: 'atomic', name: 'Root', description: 'root' },
      });
      const result = await service.updateNodeStatus(workflowId, tree.root.id, 'in_progress');
      expect(result.previousStatus).toBe('pending');
      expect(result.newStatus).toBe('in_progress');
    });

    it('rejects invalid transitions', async () => {
      const { workflowId, tree } = await service.create({
        name: 'Invalid Transition', description: 'Test invalid',
        rootNode: { type: 'atomic', name: 'Root', description: 'root' },
      });
      await service.updateNodeStatus(workflowId, tree.root.id, 'in_progress');
      await service.updateNodeStatus(workflowId, tree.root.id, 'completed');
      await expect(
        service.updateNodeStatus(workflowId, tree.root.id, 'in_progress'),
      ).rejects.toThrow('Invalid transition');
    });
  });

  describe('getProgress', () => {
    it('throws for missing workflow', async () => {
      await expect(service.getProgress('workflow-nope')).rejects.toThrow('not found');
    });

    it('reports progress for a workflow', async () => {
      const { workflowId } = await service.create({
        name: 'Progress Test', description: 'For progress',
        rootNode: {
          type: 'composite', name: 'Root', description: 'root',
          children: [
            { type: 'atomic', name: 'S1', description: 's1', status: 'pending', metadata: {} },
            { type: 'atomic', name: 'S2', description: 's2', status: 'pending', metadata: {} },
          ],
        },
      });
      const progress = await service.getProgress(workflowId);
      expect(progress.totalNodes).toBe(3);
      expect(progress.completedNodes).toBe(0);
      expect(progress.allDone).toBe(false);
    });
  });

  describe('initializeCursor', () => {
    it('throws for missing workflow', async () => {
      await expect(service.initializeCursor('workflow-nope')).rejects.toThrow('not found');
    });

    it('creates initial cursor state', async () => {
      const { workflowId } = await service.create({
        name: 'Cursor Test', description: 'For cursor init',
        rootNode: { type: 'composite', name: 'Root', description: 'root' },
      });
      const state = await service.initializeCursor(workflowId);
      expect(state.cursor.currentLeafId).toBeNull();
      expect(state.cursor.leafHistory).toEqual([]);
      expect(state.cursor.branchPath).toEqual([]);
      expect(state.version).toBe('3.0.0');
    });
  });

  describe('transition', () => {
    it('throws for missing workflow', async () => {
      await expect(service.transition('workflow-nope')).rejects.toThrow('not found');
    });

    it('throws for missing execution state', async () => {
      const { workflowId } = await service.create({
        name: 'No State Trans', description: 'no cursor',
        rootNode: { type: 'atomic', name: 'R', description: 'r' },
      });
      await expect(service.transition(workflowId)).rejects.toThrow('not found');
    });

    it('activates first leaf node', async () => {
      const { workflowId } = await service.create({
        name: 'Transition Test', description: 'For transition',
        rootNode: {
          type: 'composite', name: 'Root', description: 'root',
          children: [
            { type: 'atomic', name: 'S1', description: 's1', status: 'pending', metadata: {} },
            { type: 'atomic', name: 'S2', description: 's2', status: 'pending', metadata: {} },
          ],
        },
      });
      await service.initializeCursor(workflowId);
      const result = await service.transition(workflowId);
      expect(result.action).toBe('activate_leaf');
      expect(result.node?.name).toBe('S1');
      expect(result.todoItems).toHaveLength(3);
      expect(result.branchPath).toBeDefined();
      expect(Array.isArray(result.branchPath)).toBe(true);
    });

    it('returns workflow_complete when all done', async () => {
      const { workflowId } = await service.create({
        name: 'Complete Test', description: 'For completion',
        rootNode: {
          type: 'composite', name: 'Root', description: 'root',
          children: [
            { type: 'atomic', name: 'S1', description: 's1', status: 'pending', metadata: {} },
          ],
        },
      });
      await service.initializeCursor(workflowId);
      // First transition activates S1
      await service.transition(workflowId);
      // Second transition completes S1 and finds no more leaves
      const result = await service.transition(workflowId);
      expect(result.action).toBe('workflow_complete');
    });

    it('returns expand_composite for unexpanded composite', async () => {
      const { workflowId, tree } = await service.create({
        name: 'Expand Transition', description: 'For expand transition',
        rootNode: { type: 'composite', name: 'Root', description: 'root' },
      });
      // Expand root with one composite child that has no grandchildren
      await service.expand(workflowId, tree.root.id, [
        { type: 'composite', name: 'Sub', description: 'sub composite', status: 'pending', metadata: {} },
      ]);
      await service.initializeCursor(workflowId);
      const result = await service.transition(workflowId);
      expect(result.action).toBe('expand_composite');
    });
  });

  describe('updateTree', () => {
    it('adds a node', async () => {
      const { workflowId, tree } = await service.create({
        name: 'Add Node Test', description: 'For adding nodes',
        rootNode: { type: 'composite', name: 'Root', description: 'root' },
      });
      await service.expand(workflowId, tree.root.id, [
        { type: 'atomic', name: 'C1', description: 'c1', status: 'pending', metadata: {} },
      ]);
      const result = await service.updateTree(workflowId, [
        {
          op: 'add' as const,
          parentId: tree.root.id,
          node: { type: 'atomic', name: 'C2', description: 'c2', status: 'pending', metadata: {} },
        },
      ]);
      expect(result.applied).toBe(1);
      expect(result.totalNodes).toBe(3); // root + C1 + C2
    });

    it('removes a node', async () => {
      const { workflowId, tree } = await service.create({
        name: 'Remove Node Test', description: 'For removing nodes',
        rootNode: { type: 'composite', name: 'Root', description: 'root' },
      });
      await service.expand(workflowId, tree.root.id, [
        { id: 'remove-me', type: 'atomic', name: 'C1', description: 'c1', status: 'pending', metadata: {} },
        { type: 'atomic', name: 'C2', description: 'c2', status: 'pending', metadata: {} },
      ]);
      // Verify we have 3 nodes before removal
      const before = await service.getProgress(workflowId);
      expect(before.totalNodes).toBe(3);
      const result = await service.updateTree(workflowId, [
        { op: 'remove' as const, nodeId: 'remove-me' },
      ]);
      expect(result.applied).toBe(1);
      expect(result.totalNodes).toBe(2); // root + C2
    });

    it('modifies a node', async () => {
      const { workflowId, tree } = await service.create({
        name: 'Modify Node Test', description: 'For modifying nodes',
        rootNode: { type: 'composite', name: 'Root', description: 'root' },
      });
      await service.expand(workflowId, tree.root.id, [
        { id: 'mod-me', type: 'atomic', name: 'OldName', description: 'old', status: 'pending', metadata: {} },
      ]);
      const result = await service.updateTree(workflowId, [
        { op: 'modify' as const, nodeId: 'mod-me', updates: { name: 'NewName' } },
      ]);
      expect(result.applied).toBe(1);
    });

    it('skips add when parent not found', async () => {
      const { workflowId } = await service.create({
        name: 'No Parent', description: 'parent missing',
        rootNode: { type: 'composite', name: 'Root', description: 'root' },
      });
      const result = await service.updateTree(workflowId, [
        { op: 'add' as const, parentId: 'nonexistent', node: { type: 'atomic', name: 'X', description: 'x' } },
      ]);
      expect(result.applied).toBe(0);
    });

    it('skips remove when node not found', async () => {
      const { workflowId } = await service.create({
        name: 'No Remove', description: 'node missing',
        rootNode: { type: 'composite', name: 'Root', description: 'root' },
      });
      const result = await service.updateTree(workflowId, [
        { op: 'remove' as const, nodeId: 'nonexistent' },
      ]);
      expect(result.applied).toBe(0);
    });

    it('skips modify when node not found', async () => {
      const { workflowId } = await service.create({
        name: 'No Modify', description: 'node missing',
        rootNode: { type: 'composite', name: 'Root', description: 'root' },
      });
      const result = await service.updateTree(workflowId, [
        { op: 'modify' as const, nodeId: 'nonexistent', updates: { name: 'X' } },
      ]);
      expect(result.applied).toBe(0);
    });

    it('modifies description and status', async () => {
      const { workflowId, tree } = await service.create({
        name: 'Modify Fields', description: 'modify desc+status',
        rootNode: { type: 'composite', name: 'Root', description: 'root' },
      });
      await service.expand(workflowId, tree.root.id, [
        { id: 'mf', type: 'atomic', name: 'N', description: 'old desc', status: 'pending', metadata: {} },
      ]);
      const result = await service.updateTree(workflowId, [
        { op: 'modify' as const, nodeId: 'mf', updates: { description: 'new desc', status: 'in_progress' } },
      ]);
      expect(result.applied).toBe(1);
    });

    it('throws for missing workflow', async () => {
      await expect(
        service.updateTree('workflow-nope', []),
      ).rejects.toThrow('not found');
    });

    it('initializes children array when adding to childless parent', async () => {
      const { workflowId, tree } = await service.create({
        name: 'Init Children', description: 'no children yet',
        rootNode: { type: 'composite', name: 'Root', description: 'root' },
      });
      // Root has no children array yet — updateTree add should initialize it
      const result = await service.updateTree(workflowId, [
        { op: 'add' as const, parentId: tree.root.id, node: { type: 'atomic', name: 'C1', description: 'c1' } },
      ]);
      expect(result.applied).toBe(1);
      expect(result.totalNodes).toBe(2);
    });
  });

  describe('getCursorState', () => {
    it('returns cursor state', async () => {
      const { workflowId } = await service.create({
        name: 'Cursor State Test', description: 'For cursor state',
        rootNode: { type: 'composite', name: 'Root', description: 'root' },
      });
      await service.initializeCursor(workflowId);
      const result = await service.getCursorState(workflowId);
      expect(result.cursor.currentLeafId).toBeNull();
      expect(result.cursor.leafHistory).toEqual([]);
      expect(result.treeSummary).toBeDefined();
      expect(result.treeVisualization).toBeDefined();
      expect(result.currentNode).toBeNull();
    });

    it('returns currentNode when a leaf is active', async () => {
      const { workflowId } = await service.create({
        name: 'Active Leaf Test', description: 'For active leaf',
        rootNode: {
          type: 'composite', name: 'Root', description: 'root',
          children: [
            { type: 'atomic', name: 'S1', description: 's1', status: 'pending', metadata: {} },
          ],
        },
      });
      await service.initializeCursor(workflowId);
      await service.transition(workflowId);
      const result = await service.getCursorState(workflowId);
      expect(result.currentNode).not.toBeNull();
      expect(result.currentNode!.name).toBe('S1');
    });

    it('throws for missing workflow', async () => {
      await expect(service.getCursorState('workflow-nope')).rejects.toThrow('not found');
    });

    it('throws for missing execution state', async () => {
      const { workflowId } = await service.create({
        name: 'No State', description: 'no cursor init',
        rootNode: { type: 'atomic', name: 'R', description: 'r' },
      });
      await expect(service.getCursorState(workflowId)).rejects.toThrow('not found');
    });
  });

  describe('listActive', () => {
    it('returns empty when no workflows exist', async () => {
      const result = await service.listActive();
      expect(result).toEqual([]);
    });

    it('returns active workflow ids', async () => {
      const { workflowId } = await service.create({
        name: 'Active Test', description: 'For listActive',
        rootNode: {
          type: 'composite', name: 'Root', description: 'root',
          children: [
            { type: 'atomic', name: 'S1', description: 's1', status: 'pending', metadata: {} },
          ],
        },
      });
      const result = await service.listActive();
      expect(result).toContain(workflowId);
    });

    it('skips workflows whose data cannot be loaded', async () => {
      const { workflowId } = await service.create({
        name: 'Active', description: 'stays',
        rootNode: {
          type: 'composite', name: 'Root', description: 'root',
          children: [
            { type: 'atomic', name: 'S1', description: 's1', status: 'pending', metadata: {} },
          ],
        },
      });
      // Spy on treeStore.load to return null for a phantom ID
      const treeStore = (service as any).treeStore;
      const origLoad = treeStore.load.bind(treeStore);
      const origList = treeStore.list.bind(treeStore);
      vi.spyOn(treeStore, 'list').mockImplementation(async () => {
        const ids = await origList();
        return ['phantom-gone', ...ids];
      });
      vi.spyOn(treeStore, 'load').mockImplementation(async (id: string) => {
        if (id === 'phantom-gone') return null;
        return origLoad(id);
      });

      const result = await service.listActive();
      expect(result).toContain(workflowId);
      expect(result).not.toContain('phantom-gone');

      vi.restoreAllMocks();
    });

    it('excludes fully completed workflows', async () => {
      const { workflowId } = await service.create({
        name: 'Done Test', description: 'For listActive exclusion',
        rootNode: {
          type: 'composite', name: 'Root', description: 'root',
          children: [
            { type: 'atomic', name: 'S1', description: 's1', status: 'pending', metadata: {} },
          ],
        },
      });
      await service.initializeCursor(workflowId);
      // Transition activates S1
      await service.transition(workflowId);
      // Transition completes S1 → workflow_complete
      await service.transition(workflowId);

      const result = await service.listActive();
      expect(result).not.toContain(workflowId);
    });
  });

  describe('buildNode maxDepth', () => {
    it('throws ValidationError when depth exceeds maxDepth', async () => {
      await expect(
        service.create({
          name: 'Deep WF',
          description: 'Too deep',
          maxDepth: 1,
          rootNode: {
            type: 'composite', name: 'Root', description: 'root',
            children: [
              {
                type: 'composite', name: 'L1', description: 'l1',
                children: [
                  { type: 'atomic', name: 'L2', description: 'l2' },
                ],
              },
            ],
          },
        }),
      ).rejects.toThrow('Max depth exceeded');
    });
  });

  describe('load with includeState', () => {
    it('loads state when includeState is true', async () => {
      const { workflowId } = await service.create({
        name: 'State Test', description: 'For state loading',
        rootNode: { type: 'composite', name: 'Root', description: 'root' },
      });
      await service.initializeCursor(workflowId);

      const result = await service.load(workflowId, true);
      expect(result.found).toBe(true);
      expect(result.state).not.toBeNull();
    });

    it('does not load state when includeState is false', async () => {
      const { workflowId } = await service.create({
        name: 'No State', description: 'No state loading',
        rootNode: { type: 'atomic', name: 'Root', description: 'root' },
      });
      const result = await service.load(workflowId, false);
      expect(result.found).toBe(true);
      expect(result.state).toBeNull();
    });
  });
});
