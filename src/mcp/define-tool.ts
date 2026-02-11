import type { Envelope } from '../infra/types.js';
import { envelope, envelopeError } from '../infra/types.js';
import { AppError } from '../infra/errors.js';
import { validateJsonSchema } from '../infra/json-schema-lite.js';
import type { LiteSchema } from '../infra/json-schema-lite.js';

export interface ToolDef<TIn, TOut> {
  name: string;
  description: string;
  schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (input: TIn) => Promise<TOut>;
}

export interface ToolMetadata {
  name: string;
  description: string;
  schema: ToolDef<unknown, unknown>['schema'];
  execute: (input: unknown) => Promise<Envelope>;
}

export function defineTool<TIn, TOut>(def: ToolDef<TIn, TOut>): ToolMetadata {
  return {
    name: def.name,
    description: def.description,
    schema: def.schema,
    async execute(input: unknown): Promise<Envelope> {
      const validationErrors = validateJsonSchema(input, def.schema as LiteSchema);
      if (validationErrors.length > 0) {
        const msg = validationErrors.map((e) => e.message).join('; ');
        return envelopeError(`Validation failed: ${msg}`);
      }
      try {
        const result = await def.handler(input as TIn);
        return envelope(result);
      } catch (err: unknown) {
        if (err instanceof AppError) {
          return envelopeError(err.message, err.code, err.details);
        }
        const message = err instanceof Error ? err.message : String(err);
        return envelopeError(message);
      }
    },
  };
}
