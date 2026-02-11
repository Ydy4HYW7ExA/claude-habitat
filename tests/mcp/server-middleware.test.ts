import { describe, it, expect } from 'vitest';
import type { ToolMiddleware } from '../../src/mcp/server.js';
import type { Envelope } from '../../src/infra/types.js';
import { envelopeError } from '../../src/infra/types.js';
import { defineTool } from '../../src/mcp/define-tool.js';

/**
 * Since McpServer internally creates a Server from the MCP SDK
 * and wires handlers in the constructor, we test the middleware
 * logic by simulating the same pattern used in the handler.
 */
function runMiddlewares(
  middlewares: ToolMiddleware[],
  toolName: string,
  input: unknown,
): Envelope | null {
  for (const mw of middlewares) {
    const blocked = mw(toolName, input);
    if (blocked) return blocked;
  }
  return null;
}

describe('ToolMiddleware', () => {
  it('passes through when no middleware blocks', () => {
    const mw: ToolMiddleware = () => null;
    const result = runMiddlewares([mw], 'test_tool', { x: 1 });
    expect(result).toBeNull();
  });

  it('blocks path traversal via security validator pattern', () => {
    const securityMw: ToolMiddleware = (_name, input) => {
      const str = JSON.stringify(input);
      if (/\.\.\//.test(str)) {
        return envelopeError('Security check failed: Path traversal');
      }
      return null;
    };
    const result = runMiddlewares(
      [securityMw],
      'read_file',
      { path: '../../etc/passwd' },
    );
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect(result!.error).toContain('Path traversal');
  });

  it('blocks XSS via security validator pattern', () => {
    const securityMw: ToolMiddleware = (_name, input) => {
      const str = JSON.stringify(input);
      if (/<script\b/i.test(str)) {
        return envelopeError('Security check failed: XSS script tag');
      }
      return null;
    };
    const result = runMiddlewares(
      [securityMw],
      'save_doc',
      { content: '<script>alert(1)</script>' },
    );
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect(result!.error).toContain('XSS');
  });

  it('blocks when rate limit exceeded', () => {
    let calls = 0;
    const rateMw: ToolMiddleware = (toolName) => {
      calls++;
      if (calls > 2) {
        return envelopeError(`Rate limit exceeded for tool: ${toolName}`);
      }
      return null;
    };

    expect(runMiddlewares([rateMw], 'my_tool', {})).toBeNull();
    expect(runMiddlewares([rateMw], 'my_tool', {})).toBeNull();
    const blocked = runMiddlewares([rateMw], 'my_tool', {});
    expect(blocked).not.toBeNull();
    expect(blocked!.success).toBe(false);
    expect(blocked!.error).toContain('Rate limit exceeded');
  });

  it('first blocking middleware wins', () => {
    const mw1: ToolMiddleware = () => envelopeError('blocked by mw1');
    const mw2: ToolMiddleware = () => envelopeError('blocked by mw2');
    const result = runMiddlewares([mw1, mw2], 'tool', {});
    expect(result!.error).toBe('blocked by mw1');
  });
});
