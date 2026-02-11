import type { Schema } from '../../infra/validator.js';

export const createWorkflowSchema: Schema = {
  name: { type: 'string', min: 1, max: 200 },
  description: { type: 'string', min: 1, max: 1000 },
  maxDepth: { type: 'number', required: false, min: 1, max: 100 },
};

export const nodeSchema: Schema = {
  type: { type: 'enum', values: ['atomic', 'composite'] },
  name: { type: 'string', min: 1, max: 200 },
  description: { type: 'string', min: 1 },
  status: {
    type: 'enum',
    required: false,
    values: ['pending', 'in_progress', 'completed', 'failed', 'skipped'],
  },
};

export const cursorSchema: Schema = {
  currentLeafId: { type: 'string', required: false },
};

export const todoItemSchema: Schema = {
  subject: { type: 'string', min: 1, max: 200 },
  description: { type: 'string', min: 1 },
  activeForm: { type: 'string', min: 1, max: 200 },
  status: {
    type: 'enum',
    values: ['pending', 'in_progress', 'completed'],
  },
  parallelizable: { type: 'boolean', required: false },
};
