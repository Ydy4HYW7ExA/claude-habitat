import type { Schema } from '../../infra/validator.js';
import type { HabitatConfig } from '../config/types.js';

const TAG_PATTERN = /^[a-z][a-z0-9-]*$/;

export function createDocumentSchemaFromConfig(config?: HabitatConfig['documents']): Schema {
  return {
    name: { type: 'string', min: 1, max: config?.maxNameLength ?? 200 },
    summary: { type: 'string', min: 1, max: config?.maxSummaryLength ?? 500 },
    content: { type: 'string', required: false },
    tags: {
      type: 'array',
      minItems: config?.minTags ?? 2,
      maxItems: config?.maxTags ?? 8,
      item: { type: 'string', pattern: TAG_PATTERN },
    },
    keywords: { type: 'array', required: false, maxItems: config?.maxKeywords ?? 50 },
    refs: { type: 'array', required: false },
  };
}

export function updateDocumentSchemaFromConfig(config?: HabitatConfig['documents']): Schema {
  return {
    name: { type: 'string', required: false, min: 1, max: config?.maxNameLength ?? 200 },
    summary: { type: 'string', required: false, min: 1, max: config?.maxSummaryLength ?? 500 },
    content: { type: 'string', required: false },
    tags: {
      type: 'array',
      required: false,
      minItems: config?.minTags ?? 2,
      maxItems: config?.maxTags ?? 8,
      item: { type: 'string', pattern: TAG_PATTERN },
    },
    keywords: { type: 'array', required: false, maxItems: config?.maxKeywords ?? 50 },
    refs: { type: 'array', required: false },
  };
}

// Static defaults for backward compatibility
export const createDocumentSchema: Schema = createDocumentSchemaFromConfig();
export const updateDocumentSchema: Schema = updateDocumentSchemaFromConfig();
