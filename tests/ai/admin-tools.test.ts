import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PositionManager } from '../../src/position/manager.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { ADMIN_TOOL_NAME, TASK_PRIORITY, POSITION_STATUS, MODEL } from '../../src/constants.js';

// Mock SDK same pattern as mcp-tools.test.ts
vi.mock('@anthropic-ai/claude-agent-sdk', () => {
  const tool = (name: string, description: string, schema: any, handler: Function) => ({
    name, description, schema, handler,
  });
  const createSdkMcpServer = (config: any) => ({
    type: 'sdk', name: config.name, version: config.version, tools: config.tools,
  });
  return { tool, createSdkMcpServer };
});

vi.mock('zod/v4', () => {
  const createSchema = () => ({
    optional: () => createSchema(),
    describe: () => createSchema(),
    min: () => createSchema(),
    max: () => createSchema(),
  });
  const z = {
    string: () => createSchema(),
    number: () => createSchema(),
    array: (inner: any) => createSchema(),
    enum: (values: string[]) => createSchema(),
    record: (key: any, value: any) => createSchema(),
    unknown: () => createSchema(),
  };
  return { z };
});

function getToolHandler(server: any, toolName: string): Function {
  const toolDef = server.tools.find((t: any) => t.name === toolName);
  if (!toolDef) throw new Error(`Tool '${toolName}' not found in server`);
  return toolDef.handler;
}

describe('Admin Tool Handlers', () => {
  let tmpDir: string;
  let positionManager: PositionManager;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-test-'));
    positionManager = new PositionManager(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function getServer() {
    const { createAdminMcpServer } = await import('../../src/ai/admin-tools.js');
    return createAdminMcpServer({
      positionManager,
      projectRoot: tmpDir,
    });
  }

  it('should create a role template with workflow file', async () => {
    const server = await getServer();
    const handler = getToolHandler(server, ADMIN_TOOL_NAME.CREATE_ROLE_TEMPLATE);

    const result = await handler({
      name: 'tester',
      description: 'Test engineer',
      workflowCode: 'export default async function(ctx) {}',
      model: MODEL.HAIKU,
    });

    expect(result.content[0].text).toContain('tester');

    const template = await positionManager.getRoleTemplate('tester');
    expect(template).not.toBeNull();
    expect(template!.description).toBe('Test engineer');

    const workflowContent = await fs.readFile(
      path.join(tmpDir, '.claude-habitat/workflows/tester.ts'),
      'utf-8',
    );
    expect(workflowContent).toContain('export default');
  });

  it('should create a position from template', async () => {
    const server = await getServer();
    const createTemplate = getToolHandler(server, ADMIN_TOOL_NAME.CREATE_ROLE_TEMPLATE);
    const createPosition = getToolHandler(server, ADMIN_TOOL_NAME.CREATE_POSITION);

    await createTemplate({
      name: 'coder',
      description: 'Software engineer',
      workflowCode: 'export default async function(ctx) {}',
    });

    const result = await createPosition({
      roleTemplateName: 'coder',
      positionId: 'coder-01',
    });

    expect(result.content[0].text).toContain('coder-01');

    const position = await positionManager.getPosition('coder-01');
    expect(position).not.toBeNull();
    expect(position!.roleTemplateName).toBe('coder');
  });

  it('should list positions', async () => {
    const server = await getServer();
    const createTemplate = getToolHandler(server, ADMIN_TOOL_NAME.CREATE_ROLE_TEMPLATE);
    const createPosition = getToolHandler(server, ADMIN_TOOL_NAME.CREATE_POSITION);
    const listPositions = getToolHandler(server, ADMIN_TOOL_NAME.LIST_POSITIONS);

    await createTemplate({
      name: 'coder',
      description: 'Coder',
      workflowCode: 'export default async function(ctx) {}',
    });
    await createPosition({ roleTemplateName: 'coder', positionId: 'coder-01' });
    await createPosition({ roleTemplateName: 'coder', positionId: 'coder-02' });

    const result = await listPositions({});
    expect(result.content[0].text).toContain('coder-01');
    expect(result.content[0].text).toContain('coder-02');
  });

  it('should delete a position', async () => {
    const server = await getServer();
    const createTemplate = getToolHandler(server, ADMIN_TOOL_NAME.CREATE_ROLE_TEMPLATE);
    const createPosition = getToolHandler(server, ADMIN_TOOL_NAME.CREATE_POSITION);
    const deletePosition = getToolHandler(server, ADMIN_TOOL_NAME.DELETE_POSITION);

    await createTemplate({
      name: 'coder',
      description: 'Coder',
      workflowCode: 'export default async function(ctx) {}',
    });
    await createPosition({ roleTemplateName: 'coder', positionId: 'coder-01' });

    const result = await deletePosition({
      positionId: 'coder-01',
      reason: 'no longer needed',
    });

    expect(result.content[0].text).toContain('deleted');
    const position = await positionManager.getPosition('coder-01');
    expect(position).toBeNull();
  });

  it('should modify workflow code', async () => {
    const server = await getServer();
    const createTemplate = getToolHandler(server, ADMIN_TOOL_NAME.CREATE_ROLE_TEMPLATE);
    const createPosition = getToolHandler(server, ADMIN_TOOL_NAME.CREATE_POSITION);
    const modifyWorkflow = getToolHandler(server, ADMIN_TOOL_NAME.MODIFY_WORKFLOW);

    await createTemplate({
      name: 'coder',
      description: 'Coder',
      workflowCode: 'export default async function(ctx) { /* v1 */ }',
    });
    await createPosition({ roleTemplateName: 'coder', positionId: 'coder-01' });

    const result = await modifyWorkflow({
      positionId: 'coder-01',
      newCode: 'export default async function(ctx) { /* v2 */ }',
      reason: 'improved logic',
    });

    expect(result.content[0].text).toContain('updated');

    const content = await fs.readFile(
      path.join(tmpDir, '.claude-habitat/workflows/coder.ts'),
      'utf-8',
    );
    expect(content).toContain('v2');
  });

  it('should dispatch a task', async () => {
    const server = await getServer();
    const createTemplate = getToolHandler(server, ADMIN_TOOL_NAME.CREATE_ROLE_TEMPLATE);
    const createPosition = getToolHandler(server, ADMIN_TOOL_NAME.CREATE_POSITION);
    const dispatchTask = getToolHandler(server, ADMIN_TOOL_NAME.DISPATCH_TASK);

    await createTemplate({
      name: 'coder',
      description: 'Coder',
      workflowCode: 'export default async function(ctx) {}',
    });
    await createPosition({ roleTemplateName: 'coder', positionId: 'coder-01' });

    const result = await dispatchTask({
      targetPositionId: 'coder-01',
      taskType: 'implement',
      payload: { feature: 'auth' },
      priority: TASK_PRIORITY.HIGH,
    });

    expect(result.content[0].text).toContain('dispatched');

    const position = await positionManager.getPosition('coder-01');
    expect(position!.taskQueue).toHaveLength(1);
    expect(position!.taskQueue[0].type).toBe('implement');
    expect(position!.taskQueue[0].priority).toBe(TASK_PRIORITY.HIGH);
  });

  it('should get position status', async () => {
    const server = await getServer();
    const createTemplate = getToolHandler(server, ADMIN_TOOL_NAME.CREATE_ROLE_TEMPLATE);
    const createPosition = getToolHandler(server, ADMIN_TOOL_NAME.CREATE_POSITION);
    const getStatus = getToolHandler(server, ADMIN_TOOL_NAME.GET_POSITION_STATUS);

    await createTemplate({
      name: 'coder',
      description: 'Coder',
      workflowCode: 'export default async function(ctx) {}',
    });
    await createPosition({ roleTemplateName: 'coder', positionId: 'coder-01' });

    const result = await getStatus({ positionId: 'coder-01' });
    const status = JSON.parse(result.content[0].text);
    expect(status.id).toBe('coder-01');
    expect(status.status).toBe(POSITION_STATUS.IDLE);
  });

  it('should handle non-existent position for modify_workflow', async () => {
    const server = await getServer();
    const modifyWorkflow = getToolHandler(server, ADMIN_TOOL_NAME.MODIFY_WORKFLOW);

    const result = await modifyWorkflow({
      positionId: 'nonexistent',
      newCode: 'code',
      reason: 'test',
    });
    expect(result.content[0].text).toContain('not found');
  });
});
