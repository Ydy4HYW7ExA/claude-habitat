import { describe, it, expect } from 'vitest';
import { defineTool } from '../../src/mcp/define-tool.js';
import { AppError } from '../../src/infra/errors.js';

describe('defineTool', () => {
  it('creates tool metadata', () => {
    const tool = defineTool({
      name: 'test_tool',
      description: 'A test tool',
      schema: {
        type: 'object',
        properties: { x: { type: 'string' } },
        required: ['x'],
      },
      async handler(input: { x: string }) {
        return { echo: input.x };
      },
    });
    expect(tool.name).toBe('test_tool');
    expect(tool.description).toBe('A test tool');
  });

  it('wraps success in envelope', async () => {
    const tool = defineTool({
      name: 't',
      description: 't',
      schema: { type: 'object', properties: {} },
      async handler() {
        return { value: 42 };
      },
    });
    const result = await tool.execute({});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ value: 42 });
  });

  it('wraps errors in envelope', async () => {
    const tool = defineTool({
      name: 't',
      description: 't',
      schema: { type: 'object', properties: {} },
      async handler() {
        throw new Error('boom');
      },
    });
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
  });

  it('wraps non-Error throws in envelope', async () => {
    const tool = defineTool({
      name: 't',
      description: 't',
      schema: { type: 'object', properties: {} },
      async handler() {
        throw 'string error';
      },
    });
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toBe('string error');
  });

  it('rejects missing required fields with validation error', async () => {
    const tool = defineTool({
      name: 't',
      description: 't',
      schema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
      async handler(input: { name: string }) {
        return { echo: input.name };
      },
    });
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
    expect(result.error).toContain('Missing required field: name');
  });

  it('rejects non-object input with validation error', async () => {
    const tool = defineTool({
      name: 't',
      description: 't',
      schema: { type: 'object', properties: {} },
      async handler() {
        return { ok: true };
      },
    });
    const result = await tool.execute('not an object');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
    expect(result.error).toContain('Input must be an object');
  });

  it('preserves AppError code and details in envelope', async () => {
    const tool = defineTool({
      name: 't',
      description: 't',
      schema: { type: 'object', properties: {} },
      async handler() {
        throw new AppError('Not found', 'NOT_FOUND', { entity: 'Doc', id: '123' });
      },
    });
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
    expect(result.errorCode).toBe('NOT_FOUND');
    expect(result.errorDetails).toEqual({ entity: 'Doc', id: '123' });
  });
});
