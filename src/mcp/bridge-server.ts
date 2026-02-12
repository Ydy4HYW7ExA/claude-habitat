#!/usr/bin/env node
/**
 * MCP Bridge Server — child process entry point.
 *
 * stdin/stdout ←→ claude CLI (MCP stdio protocol)
 * Unix socket  ←→ parent process (JSON-RPC over newline-delimited JSON)
 *
 * Spawned by claude CLI via --mcp-config. Connects back to the parent
 * habitat process through a Unix socket to forward tool calls.
 */
import * as net from 'node:net';
import { nanoid } from 'nanoid';
import { MCP_BRIDGE_SERVER_NAME } from '../constants.js';

const SOCKET_PATH = process.env['HABITAT_SOCKET'];
if (!SOCKET_PATH) {
  process.stderr.write('HABITAT_SOCKET env var not set\n');
  process.exit(1);
}

// ─── Socket client (connects to parent process) ────────────────────

interface SocketResponse {
  id: string;
  result?: unknown;
  error?: string;
}

interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

let socket: net.Socket;
const pendingRequests = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}>();

function connectSocket(): Promise<void> {
  return new Promise((resolve, reject) => {
    const connectTimeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Socket connection timed out after 10s'));
    }, 10_000);

    socket = net.createConnection(SOCKET_PATH!, () => {
      clearTimeout(connectTimeout);
      resolve();
    });
    socket.on('error', (err) => {
      clearTimeout(connectTimeout);
      reject(err);
    });

    let buffer = '';
    socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop()!;
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response = JSON.parse(line) as SocketResponse;
          const pending = pendingRequests.get(response.id);
          if (pending) {
            pendingRequests.delete(response.id);
            if (response.error) {
              pending.reject(new Error(response.error));
            } else {
              pending.resolve(response.result);
            }
          }
        } catch {
          process.stderr.write(`Invalid JSON from socket: ${line.slice(0, 100)}\n`);
        }
      }
    });
  });
}

function ipcCall(method: string, args: unknown): Promise<unknown> {
  const id = nanoid(8);
  return new Promise((resolve, reject) => {
    const callTimeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`IPC call '${method}' timed out after 30s`));
    }, 30_000);

    pendingRequests.set(id, {
      resolve: (value: unknown) => {
        clearTimeout(callTimeout);
        resolve(value);
      },
      reject: (err: Error) => {
        clearTimeout(callTimeout);
        reject(err);
      },
    });
    const msg = JSON.stringify({ id, method, args }) + '\n';
    socket.write(msg);
  });
}

// ─── Tool definitions (mirrors src/ai/mcp-tools.ts + admin-tools.ts) ─

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// Position-level tools
const POSITION_TOOLS: ToolDef[] = [
  {
    name: 'remember',
    description: '记录一条新记忆到岗位记忆库',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '记忆内容' },
        keywords: { type: 'array', items: { type: 'string' }, description: '关键词列表' },
        summary: { type: 'string', description: '一句话摘要' },
      },
      required: ['content'],
    },
  },
  {
    name: 'recall',
    description: '从岗位记忆库检索相关记忆',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        layer: { type: 'string', description: '限定记忆层级' },
        limit: { type: 'number', description: '返回条数上限' },
      },
      required: ['query'],
    },
  },
  {
    name: 'forget',
    description: '删除一条记忆',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '记忆条目 ID' },
        reason: { type: 'string', description: '删除原因' },
      },
      required: ['id', 'reason'],
    },
  },
  {
    name: 'rewrite_memory',
    description: '重写一条记忆',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '记忆条目 ID' },
        newContent: { type: 'string', description: '新内容' },
        newSummary: { type: 'string', description: '新摘要' },
        newKeywords: { type: 'array', items: { type: 'string' }, description: '新关键词' },
      },
      required: ['id', 'newContent'],
    },
  },
  {
    name: 'recall_global',
    description: '从全局记忆库检索',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        limit: { type: 'number', description: '返回条数上限' },
      },
      required: ['query'],
    },
  },
  {
    name: 'remember_global',
    description: '写入全局记忆库',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '记忆内容' },
        keywords: { type: 'array', items: { type: 'string' }, description: '关键词列表' },
        summary: { type: 'string', description: '一句话摘要' },
      },
      required: ['content'],
    },
  },
  {
    name: 'emit_task',
    description: '向其他岗位发送任务',
    inputSchema: {
      type: 'object',
      properties: {
        taskType: { type: 'string', description: '任务类型' },
        payload: { type: 'object', description: '任务数据' },
        targetPositionId: { type: 'string', description: '目标岗位 ID' },
      },
      required: ['taskType', 'payload'],
    },
  },
  {
    name: 'get_my_tasks',
    description: '查看我的待处理任务',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'report_status',
    description: '报告当前状态',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: '状态描述' },
        progress: { type: 'number', description: '进度百分比' },
      },
      required: ['status'],
    },
  },
  {
    name: 'request_workflow_change',
    description: '提出工作流修改建议',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: '修改描述' },
        suggestedCode: { type: 'string', description: '建议的新代码' },
        reason: { type: 'string', description: '修改原因' },
      },
      required: ['description', 'reason'],
    },
  },
];

// Admin tools (only for admin positions)
const ADMIN_TOOLS: ToolDef[] = [
  {
    name: 'list_positions',
    description: '列出所有岗位',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'dispatch_task',
    description: '向岗位派发任务',
    inputSchema: {
      type: 'object',
      properties: {
        targetPositionId: { type: 'string', description: '目标岗位 ID' },
        taskType: { type: 'string', description: '任务类型' },
        payload: { type: 'object', description: '任务数据' },
        priority: { type: 'string', description: '优先级' },
      },
      required: ['targetPositionId', 'taskType', 'payload'],
    },
  },
  {
    name: 'get_position_status',
    description: '查看岗位状态',
    inputSchema: {
      type: 'object',
      properties: {
        positionId: { type: 'string', description: '岗位 ID' },
      },
      required: ['positionId'],
    },
  },
];

// ─── MCP stdio protocol (minimal implementation) ────────────────────

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

const IS_ADMIN = process.env['HABITAT_IS_ADMIN'] === 'true';
const allTools = IS_ADMIN ? [...POSITION_TOOLS, ...ADMIN_TOOLS] : POSITION_TOOLS;

function sendResponse(id: string | number, result: unknown): void {
  const msg: JsonRpcMessage = { jsonrpc: '2.0', id, result };
  const data = JSON.stringify(msg);
  process.stdout.write(`${data}\n`);
}

function sendError(id: string | number, code: number, message: string): void {
  const msg: JsonRpcMessage = { jsonrpc: '2.0', id, error: { code, message } };
  const data = JSON.stringify(msg);
  process.stdout.write(`${data}\n`);
}

async function handleRequest(msg: JsonRpcMessage): Promise<void> {
  if (!msg.id) return; // Notification, ignore

  switch (msg.method) {
    case 'initialize':
      sendResponse(msg.id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: MCP_BRIDGE_SERVER_NAME, version: '0.1.0' },
      });
      break;

    case 'tools/list':
      sendResponse(msg.id, {
        tools: allTools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
      break;

    case 'tools/call': {
      const params = msg.params as ToolCallParams;
      try {
        const result = await ipcCall(params.name, params.arguments ?? {});
        // If result is already MCP-formatted, pass through; otherwise wrap
        if (result && typeof result === 'object' && 'content' in (result as Record<string, unknown>)) {
          sendResponse(msg.id, result);
        } else {
          sendResponse(msg.id, {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          });
        }
      } catch (err) {
        sendResponse(msg.id, {
          content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        });
      }
      break;
    }

    case 'notifications/initialized':
      // Client notification, no response needed
      break;

    default:
      sendError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await connectSocket();

  let buffer = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as JsonRpcMessage;
        handleRequest(msg).catch((err) => {
          process.stderr.write(`Request handling error: ${err}\n`);
        });
      } catch {
        process.stderr.write(`Invalid JSON from stdin: ${line.slice(0, 100)}\n`);
      }
    }
  });

  process.stdin.on('end', () => {
    socket.destroy();
    process.exit(0);
  });
}

main().catch((err) => {
  process.stderr.write(`Bridge server fatal error: ${err}\n`);
  process.exit(1);
});
