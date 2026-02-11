import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Container } from '../../src/di/container.js';
import { Tokens } from '../../src/di/tokens.js';
import { JsonStore } from '../../src/infra/json-store.js';
import { Logger } from '../../src/logging/logger.js';
import { DocumentService } from '../../src/domain/document/service.js';
import { WorkflowService } from '../../src/domain/workflow/service.js';
import { registerDocumentTools } from '../../src/mcp/tools/document.js';
import { registerWorkflowTools } from '../../src/mcp/tools/workflow.js';
import type { ToolMetadata } from '../../src/mcp/define-tool.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('MCP Tools Integration', () => {
  let dir: string;
  let container: Container;
  let docTools: ToolMetadata[];
  let wfTools: ToolMetadata[];

  beforeEach(async () => {
    dir = join(tmpdir(), `mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
      new DocumentService(docStore, logger, { maxKeywords: 20 }),
    );

    const treeStore = new JsonStore<any>(treeDir);
    const stateStore = new JsonStore<any>(stateDir);
    container.register(Tokens.WorkflowService, () =>
      new WorkflowService(treeStore, stateStore, logger, { maxDepth: 10 }),
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

  describe('document tools', () => {
    it('creates and reads a document', async () => {
      const create = findTool(docTools, 'habitat_doc_create');
      const read = findTool(docTools, 'habitat_doc_read');

      const createResult = await create.execute({
        name: 'Test', summary: 'A test', tags: ['test', 'mcp'],
      });
      expect(createResult.success).toBe(true);
      const docId = (createResult.data as any).documentId;

      const readResult = await read.execute({ id: docId, view: 'full' });
      expect(readResult.success).toBe(true);
      expect((readResult.data as any).found).toBe(true);
    });

    it('lists documents', async () => {
      const create = findTool(docTools, 'habitat_doc_create');
      const list = findTool(docTools, 'habitat_doc_list');

      await create.execute({ name: 'A', summary: 'a', tags: ['test', 'list'] });
      await create.execute({ name: 'B', summary: 'b', tags: ['test', 'list'] });

      const result = await list.execute({});
      expect(result.success).toBe(true);
      expect((result.data as any).total).toBe(2);
    });

    it('deletes a document', async () => {
      const create = findTool(docTools, 'habitat_doc_create');
      const del = findTool(docTools, 'habitat_doc_delete');

      const cr = await create.execute({ name: 'X', summary: 'x', tags: ['test', 'del'] });
      const docId = (cr.data as any).documentId;

      const result = await del.execute({ id: docId });
      expect(result.success).toBe(true);
      expect((result.data as any).deleted).toBe(true);
    });

    it('habitat_doc_read returns error for missing doc', async () => {
      const read = findTool(docTools, 'habitat_doc_read');
      const result = await read.execute({ id: 'doc-nonexistent' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('habitat_doc_update updates a document', async () => {
      const create = findTool(docTools, 'habitat_doc_create');
      const update = findTool(docTools, 'habitat_doc_update');

      const cr = await create.execute({ name: 'Old', summary: 'old', tags: ['test', 'upd'] });
      const docId = (cr.data as any).documentId;

      const result = await update.execute({ id: docId, updates: { name: 'New' } });
      expect(result.success).toBe(true);
      expect((result.data as any).documentId).toBe(docId);
    });

    it('habitat_doc_graph returns graph for a document', async () => {
      const create = findTool(docTools, 'habitat_doc_create');
      const graph = findTool(docTools, 'habitat_doc_graph');

      const cr = await create.execute({ name: 'G', summary: 'g', tags: ['test', 'graph'] });
      const docId = (cr.data as any).documentId;

      const result = await graph.execute({ id: docId, depth: 1 });
      expect(result.success).toBe(true);
      expect((result.data as any).center).toBe(docId);
      expect((result.data as any).stats.nodeCount).toBe(1);
    });

    it('habitat_doc_graph uses default depth when not provided', async () => {
      const create = findTool(docTools, 'habitat_doc_create');
      const graph = findTool(docTools, 'habitat_doc_graph');

      const cr = await create.execute({ name: 'DefDepth', summary: 'dd', tags: ['test', 'graph'] });
      const docId = (cr.data as any).documentId;

      const result = await graph.execute({ id: docId });
      expect(result.success).toBe(true);
      expect((result.data as any).center).toBe(docId);
    });
  });

  describe('workflow tools', () => {
    it('creates and loads a workflow', async () => {
      const create = findTool(wfTools, 'habitat_workflow_create');
      const load = findTool(wfTools, 'habitat_workflow_load');

      const cr = await create.execute({
        name: 'Test WF',
        description: 'A test',
        rootNode: { type: 'atomic', name: 'Root', description: 'root' },
      });
      expect(cr.success).toBe(true);
      const wfId = (cr.data as any).workflowId;

      const lr = await load.execute({ workflowId: wfId });
      expect(lr.success).toBe(true);
      expect((lr.data as any).found).toBe(true);
    });

    it('updates node status via habitat_workflow_update_status', async () => {
      const create = findTool(wfTools, 'habitat_workflow_create');
      const update = findTool(wfTools, 'habitat_workflow_update_status');

      const cr = await create.execute({
        name: 'Status WF',
        description: 'For status test',
        rootNode: { type: 'atomic', name: 'Root', description: 'root' },
      });
      const wfId = (cr.data as any).workflowId;

      const result = await update.execute({
        workflowId: wfId,
        nodeId: wfId,
        status: 'in_progress',
      });
      expect(result.success).toBe(true);
      expect((result.data as any).previousStatus).toBe('pending');
      expect((result.data as any).newStatus).toBe('in_progress');
    });

    it('gets progress via habitat_workflow_get_progress', async () => {
      const create = findTool(wfTools, 'habitat_workflow_create');
      const progress = findTool(wfTools, 'habitat_workflow_get_progress');

      const cr = await create.execute({
        name: 'Progress WF',
        description: 'For progress test',
        rootNode: {
          type: 'composite', name: 'Root', description: 'root',
          children: [
            { type: 'atomic', name: 'S1', description: 's1', status: 'pending', metadata: {} },
            { type: 'atomic', name: 'S2', description: 's2', status: 'pending', metadata: {} },
          ],
        },
      });
      const wfId = (cr.data as any).workflowId;

      const result = await progress.execute({ workflowId: wfId });
      expect(result.success).toBe(true);
      expect((result.data as any).totalNodes).toBe(3);
      expect((result.data as any).completedNodes).toBe(0);
      expect((result.data as any).allDone).toBe(false);
    });
  });
});