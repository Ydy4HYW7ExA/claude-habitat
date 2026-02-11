import type { Container } from '../../di/container.js';
import { Tokens } from '../../di/tokens.js';
import { defineTool, type ToolMetadata } from '../define-tool.js';

export function registerDocumentTools(container: Container): ToolMetadata[] {
  const svc = container.resolve(Tokens.DocumentService);

  return [
    defineTool({
      name: 'habitat_doc_create',
      description: 'Creates a new document.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          summary: { type: 'string' },
          content: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          keywords: { type: 'array', items: { type: 'string' } },
          refs: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'summary', 'tags'],
      },
      async handler(input: {
        name: string; summary: string; content?: string;
        tags: string[]; keywords?: string[]; refs?: string[];
      }) {
        const doc = await svc.create(input);
        return { documentId: doc.id };
      },
    }),

    defineTool({
      name: 'habitat_doc_read',
      description: 'Read a document by ID.',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          view: { type: 'string', enum: ['summary', 'full'] },
        },
        required: ['id'],
      },
      async handler(input: { id: string; view?: 'summary' | 'full' }) {
        const doc = await svc.read(input.id, input.view ?? 'summary');
        return { found: true, document: doc };
      },
    }),

    defineTool({
      name: 'habitat_doc_update',
      description: 'Updates an existing document.',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          updates: { type: 'object' },
        },
        required: ['id', 'updates'],
      },
      async handler(input: { id: string; updates: Record<string, unknown> }) {
        const doc = await svc.update(input.id, input.updates);
        return { documentId: doc.id };
      },
    }),

    defineTool({
      name: 'habitat_doc_delete',
      description: 'Delete a document.',
      schema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      async handler(input: { id: string }) {
        await svc.delete(input.id);
        return { deleted: true, documentId: input.id };
      },
    }),

    defineTool({
      name: 'habitat_doc_list',
      description: 'Query documents with filters.',
      schema: {
        type: 'object',
        properties: {
          tags: { type: 'array', items: { type: 'string' } },
          keyword: { type: 'string' },
          limit: { type: 'number' },
          offset: { type: 'number' },
          sortBy: { type: 'string', enum: ['name', 'createdAt', 'updatedAt'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] },
        },
      },
      async handler(input: {
        tags?: string[]; keyword?: string;
        limit?: number; offset?: number;
        sortBy?: 'name' | 'createdAt' | 'updatedAt';
        sortOrder?: 'asc' | 'desc';
      }) {
        return svc.list(input);
      },
    }),

    defineTool({
      name: 'habitat_doc_graph',
      description: 'Get reference graph for a document.',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          depth: { type: 'number' },
        },
        required: ['id'],
      },
      async handler(input: { id: string; depth?: number }) {
        const graph = await svc.graph(input.id, input.depth ?? 1);
        return {
          center: input.id,
          ...graph,
          stats: {
            nodeCount: graph.nodes.length,
            edgeCount: graph.edges.length,
          },
        };
      },
    }),
  ];
}
