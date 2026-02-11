import type { Check, Issue } from '../../infra/integrity.js';
import type { Document } from './types.js';

export const documentChecks: Check<Document>[] = [
  // Check required fields
  (doc) => {
    const issues: Issue[] = [];
    if (!doc.id) issues.push({ severity: 'error', category: 'id', message: 'Missing document ID', entityId: doc.id, repairable: false });
    if (!doc.name) issues.push({ severity: 'error', category: 'name', message: 'Missing document name', entityId: doc.id, repairable: false });
    if (!doc.summary) issues.push({ severity: 'error', category: 'summary', message: 'Missing document summary', entityId: doc.id, repairable: false });
    return issues;
  },

  // Check tags
  (doc) => {
    const issues: Issue[] = [];
    if (!doc.tags || doc.tags.length < 2) {
      issues.push({ severity: 'error', category: 'tags', message: 'Document must have at least 2 tags', entityId: doc.id, repairable: false });
    }
    if (doc.tags && doc.tags.length > 8) {
      issues.push({ severity: 'warning', category: 'tags', message: 'Document has more than 8 tags', entityId: doc.id, repairable: false });
    }
    return issues;
  },

  // Check timestamps
  (doc) => {
    const issues: Issue[] = [];
    if (!doc.createdAt) {
      issues.push({ severity: 'error', category: 'timestamp', message: 'Missing createdAt', entityId: doc.id, repairable: false });
    }
    if (!doc.updatedAt) {
      issues.push({ severity: 'error', category: 'timestamp', message: 'Missing updatedAt', entityId: doc.id, repairable: false });
    }
    return issues;
  },
];
