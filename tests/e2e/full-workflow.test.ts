import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Container } from '../../src/di/container.js';
import { Tokens } from '../../src/di/tokens.js';
import { JsonStore } from '../../src/infra/json-store.js';
import { Logger } from '../../src/logging/logger.js';
import { DocumentService } from '../../src/domain/document/service.js';
import { WorkflowService } from '../../src/domain/workflow/service.js';
import { SkillParser } from '../../src/domain/skill/parser.js';
import { registerDocumentTools } from '../../src/mcp/tools/document.js';
import { registerWorkflowTools } from '../../src/mcp/tools/workflow.js';
import type { ToolMetadata } from '../../src/mcp/define-tool.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('E2E: Full Workflow', () => {
  let dir: string;
  let container: Container;
  let docTools: ToolMetadata[];
  let wfTools: ToolMetadata[];

  beforeEach(async () => {
    dir = join(tmpdir(), `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const docDir = join(dir, 'documents');
    const treeDir = join(dir, 'trees');
    const stateDir = join(dir, 'states');
    await fs.mkdir(docDir, { recursive: true });
    await fs.mkdir(treeDir, { recursive: true });
    await fs.mkdir(stateDir, { recursive: true });

    const logger = new Logger({ level: 'error' });
    container = new Container();

    const docStore = new JsonStore<any>(docDir);
    container.register(Tokens.DocumentService, () =>
      new DocumentService(docStore, logger),
    );

    const treeStore = new JsonStore<any>(treeDir);
    const stateStore = new JsonStore<any>(stateDir);
    container.register(Tokens.WorkflowService, () =>
      new WorkflowService(treeStore, stateStore, logger),
    );

    docTools = registerDocumentTools(container);
    wfTools = registerWorkflowTools(container);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  function findTool(tools: ToolMetadata[], name: string): ToolMetadata {
    const t = tools.find((t) => t.name === name);
    if (!t) throw new Error(`Tool not found: ${name}`);
    return t;
  }

  it('complete document lifecycle', async () => {
    const create = findTool(docTools, 'habitat_doc_create');
    const read = findTool(docTools, 'habitat_doc_read');
    const update = findTool(docTools, 'habitat_doc_update');
    const list = findTool(docTools, 'habitat_doc_list');
    const del = findTool(docTools, 'habitat_doc_delete');
    const graph = findTool(docTools, 'habitat_doc_graph');

    // Create two documents
    const r1 = await create.execute({
      name: 'Architecture',
      summary: 'System architecture doc',
      content: 'Describes the overall system architecture',
      tags: ['architecture', 'design'],
    });
    expect(r1.success).toBe(true);
    const docA = (r1.data as any).documentId;

    const r2 = await create.execute({
      name: 'Implementation',
      summary: 'Implementation details',
      tags: ['implementation', 'code'],
      refs: [docA],
    });
    expect(r2.success).toBe(true);
    const docB = (r2.data as any).documentId;

    // Read full document
    const readR = await read.execute({ id: docA, view: 'full' });
    expect(readR.success).toBe(true);
    const docData = (readR.data as any).document;
    expect(docData.name).toBe('Architecture');
    expect(docData.refsBy).toContain(docB);

    // Update document
    const upR = await update.execute({
      id: docA,
      updates: { summary: 'Updated architecture doc' },
    });
    expect(upR.success).toBe(true);

    // List documents
    const listR = await list.execute({ tags: ['architecture'] });
    expect(listR.success).toBe(true);
    expect((listR.data as any).total).toBe(1);

    // Graph
    const graphR = await graph.execute({ id: docA, depth: 1 });
    expect(graphR.success).toBe(true);
    expect((graphR.data as any).nodes.length).toBe(2);

    // Delete
    const delR = await del.execute({ id: docB });
    expect(delR.success).toBe(true);

    // Verify ref cleanup
    const afterDel = await read.execute({ id: docA, view: 'full' });
    expect((afterDel.data as any).document.refsBy).not.toContain(docB);
  });

  it('complete workflow lifecycle', async () => {
    const create = findTool(wfTools, 'habitat_workflow_create');
    const load = findTool(wfTools, 'habitat_workflow_load');
    const expand = findTool(wfTools, 'habitat_workflow_expand');

    // Create workflow
    const cr = await create.execute({
      name: 'Build Pipeline',
      description: 'CI/CD pipeline',
      rootNode: {
        type: 'composite',
        name: 'Pipeline',
        description: 'Main pipeline',
      },
    });
    expect(cr.success).toBe(true);
    const wfId = (cr.data as any).workflowId;

    // Load workflow
    const lr = await load.execute({ workflowId: wfId });
    expect(lr.success).toBe(true);
    expect((lr.data as any).found).toBe(true);

    // Expand root with children
    const er = await expand.execute({
      workflowId: wfId,
      nodeId: wfId,
      children: [
        { id: 'step-1', type: 'atomic', name: 'Build', description: 'Compile', status: 'pending', metadata: {} },
        { id: 'step-2', type: 'atomic', name: 'Test', description: 'Run tests', status: 'pending', metadata: {} },
      ],
    });
    expect(er.success).toBe(true);
    expect((er.data as any).childrenAdded).toBe(2);
    expect((er.data as any).totalNodes).toBe(3);

    // Verify expanded tree
    const lr2 = await load.execute({ workflowId: wfId });
    const tree = (lr2.data as any).tree;
    expect(tree.root.children).toHaveLength(2);
  });

  it('leaf transition cycle', async () => {
    const create = findTool(wfTools, 'habitat_workflow_create');
    const expand = findTool(wfTools, 'habitat_workflow_expand');
    const initCursor = findTool(wfTools, 'habitat_workflow_init_cursor');
    const transition = findTool(wfTools, 'habitat_workflow_transition');

    // Create workflow with composite root
    const cr = await create.execute({
      name: 'Leaf Cycle',
      description: 'Test leaf transitions',
      rootNode: {
        type: 'composite',
        name: 'Root',
        description: 'Composite root',
      },
    });
    expect(cr.success).toBe(true);
    const wfId = (cr.data as any).workflowId;

    // Expand root with 2 atomic children
    const er = await expand.execute({
      workflowId: wfId,
      nodeId: wfId,
      children: [
        { id: 'step-1', type: 'atomic', name: 'Step 1', description: 'First step', status: 'pending', metadata: {} },
        { id: 'step-2', type: 'atomic', name: 'Step 2', description: 'Second step', status: 'pending', metadata: {} },
      ],
    });
    expect(er.success).toBe(true);

    // Init cursor
    const ic = await initCursor.execute({ workflowId: wfId });
    expect(ic.success).toBe(true);

    // Transition to first leaf
    const t1 = await transition.execute({ workflowId: wfId });
    expect(t1.success).toBe(true);
    expect((t1.data as any).action).toBe('activate_leaf');
    expect((t1.data as any).branchPath).toBeDefined();

    // Transition to second leaf
    const t2 = await transition.execute({ workflowId: wfId });
    expect(t2.success).toBe(true);
    expect((t2.data as any).action).toBe('activate_leaf');

    // Transition to complete
    const t3 = await transition.execute({ workflowId: wfId });
    expect(t3.success).toBe(true);
    expect((t3.data as any).action).toBe('workflow_complete');
  });

  it('unexpanded composite triggers expand_composite', async () => {
    const create = findTool(wfTools, 'habitat_workflow_create');
    const expand = findTool(wfTools, 'habitat_workflow_expand');
    const initCursor = findTool(wfTools, 'habitat_workflow_init_cursor');
    const transition = findTool(wfTools, 'habitat_workflow_transition');

    // Create workflow with composite root
    const cr = await create.execute({
      name: 'Composite Expand',
      description: 'Test unexpanded composite',
      rootNode: {
        type: 'composite',
        name: 'Root',
        description: 'Composite root',
      },
    });
    expect(cr.success).toBe(true);
    const wfId = (cr.data as any).workflowId;

    // Expand root with one composite child (no grandchildren)
    const er = await expand.execute({
      workflowId: wfId,
      nodeId: wfId,
      children: [
        { id: 'sub-composite', type: 'composite', name: 'Sub Composite', description: 'Nested composite', status: 'pending', metadata: {} },
      ],
    });
    expect(er.success).toBe(true);

    // Init cursor
    const ic = await initCursor.execute({ workflowId: wfId });
    expect(ic.success).toBe(true);

    // Transition should trigger expand_composite for unexpanded composite
    const t1 = await transition.execute({ workflowId: wfId });
    expect(t1.success).toBe(true);
    expect((t1.data as any).action).toBe('expand_composite');

    // Expand the composite child with an atomic child
    const er2 = await expand.execute({
      workflowId: wfId,
      nodeId: 'sub-composite',
      children: [
        { id: 'leaf-1', type: 'atomic', name: 'Leaf', description: 'Atomic leaf', status: 'pending', metadata: {} },
      ],
    });
    expect(er2.success).toBe(true);

    // Transition should now activate the leaf
    const t2 = await transition.execute({ workflowId: wfId });
    expect(t2.success).toBe(true);
    expect((t2.data as any).action).toBe('activate_leaf');
  });

  it('updateTree operations', async () => {
    const create = findTool(wfTools, 'habitat_workflow_create');
    const expand = findTool(wfTools, 'habitat_workflow_expand');
    const updateTree = findTool(wfTools, 'habitat_workflow_update_tree');

    // Create workflow with composite root
    const cr = await create.execute({
      name: 'Tree Updates',
      description: 'Test tree mutations',
      rootNode: {
        type: 'composite',
        name: 'Root',
        description: 'Composite root',
      },
    });
    expect(cr.success).toBe(true);
    const wfId = (cr.data as any).workflowId;

    // Expand root with 2 atomic children
    const er = await expand.execute({
      workflowId: wfId,
      nodeId: wfId,
      children: [
        { id: 'child-1', type: 'atomic', name: 'Child 1', description: 'First', status: 'pending', metadata: {} },
        { id: 'child-2', type: 'atomic', name: 'Child 2', description: 'Second', status: 'pending', metadata: {} },
      ],
    });
    expect(er.success).toBe(true);
    const initialTotal = (er.data as any).totalNodes;

    // Add a node
    const addR = await updateTree.execute({
      workflowId: wfId,
      operations: [
        { op: 'add', parentId: wfId, node: { id: 'child-3', type: 'atomic', name: 'Child 3', description: 'Third', status: 'pending', metadata: {} } },
      ],
    });
    expect(addR.success).toBe(true);
    expect((addR.data as any).totalNodes).toBe(initialTotal + 1);

    // Remove a node
    const rmR = await updateTree.execute({
      workflowId: wfId,
      operations: [
        { op: 'remove', nodeId: 'child-3' },
      ],
    });
    expect(rmR.success).toBe(true);
    expect((rmR.data as any).totalNodes).toBe(initialTotal);
  });

  it('cursor state reflects position', async () => {
    const create = findTool(wfTools, 'habitat_workflow_create');
    const expand = findTool(wfTools, 'habitat_workflow_expand');
    const initCursor = findTool(wfTools, 'habitat_workflow_init_cursor');
    const transition = findTool(wfTools, 'habitat_workflow_transition');
    const cursorState = findTool(wfTools, 'habitat_workflow_cursor_state');

    // Create workflow with composite root
    const cr = await create.execute({
      name: 'Cursor State',
      description: 'Test cursor state tracking',
      rootNode: {
        type: 'composite',
        name: 'Root',
        description: 'Composite root',
      },
    });
    expect(cr.success).toBe(true);
    const wfId = (cr.data as any).workflowId;

    // Expand root with children
    const er = await expand.execute({
      workflowId: wfId,
      nodeId: wfId,
      children: [
        { id: 'task-1', type: 'atomic', name: 'Task 1', description: 'First task', status: 'pending', metadata: {} },
        { id: 'task-2', type: 'atomic', name: 'Task 2', description: 'Second task', status: 'pending', metadata: {} },
      ],
    });
    expect(er.success).toBe(true);

    // Init cursor
    const ic = await initCursor.execute({ workflowId: wfId });
    expect(ic.success).toBe(true);

    // Check cursor state - should have no current leaf yet
    const cs1 = await cursorState.execute({ workflowId: wfId });
    expect(cs1.success).toBe(true);
    expect((cs1.data as any).cursor.currentLeafId).toBeNull();

    // Transition to first node
    const t1 = await transition.execute({ workflowId: wfId });
    expect(t1.success).toBe(true);

    // Check cursor state - currentNode should be set
    const cs2 = await cursorState.execute({ workflowId: wfId });
    expect(cs2.success).toBe(true);
    expect((cs2.data as any).currentNode).toBeDefined();
  });

  it('habitat_workflow_status returns no active workflow when empty', async () => {
    const workflowStatus = findTool(wfTools, 'habitat_workflow_status');
    const result = await workflowStatus.execute({});
    expect(result.success).toBe(true);
    expect((result.data as any).hasActiveWorkflow).toBe(false);
  });

  it('habitat_workflow_status returns active workflow status', async () => {
    const create = findTool(wfTools, 'habitat_workflow_create');
    const expand = findTool(wfTools, 'habitat_workflow_expand');
    const initCursor = findTool(wfTools, 'habitat_workflow_init_cursor');
    const transition = findTool(wfTools, 'habitat_workflow_transition');
    const workflowStatus = findTool(wfTools, 'habitat_workflow_status');

    // Create and set up a workflow
    const cr = await create.execute({
      name: 'Status Test',
      description: 'Test habitat_workflow_status',
      rootNode: {
        type: 'composite',
        name: 'Root',
        description: 'Composite root',
      },
    });
    const wfId = (cr.data as any).workflowId;

    await expand.execute({
      workflowId: wfId,
      nodeId: wfId,
      children: [
        { id: 'task-1', type: 'atomic', name: 'Task 1', description: 'First', status: 'pending', metadata: {} },
      ],
    });

    await initCursor.execute({ workflowId: wfId });
    await transition.execute({ workflowId: wfId });

    // Check habitat_workflow_status
    const result = await workflowStatus.execute({});
    expect(result.success).toBe(true);
    expect((result.data as any).hasActiveWorkflow).toBe(true);
    expect((result.data as any).workflowId).toBe(wfId);
    expect((result.data as any).treeSummary).toBeDefined();
  });
});
