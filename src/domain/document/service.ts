import type { JsonStore } from '../../infra/json-store.js';
import type { Logger } from '../../logging/logger.js';
import type { HabitatConfig } from '../config/types.js';
import type { Document, CreateDocumentInput, UpdateDocumentInput, DocumentMetadata } from './types.js';
import { toMetadata } from './types.js';
import { MultiMap } from '../../infra/multi-map.js';
import { validate } from '../../infra/validator.js';
import { query, type QueryOptions } from '../../infra/query.js';
import { createDocumentSchemaFromConfig, updateDocumentSchemaFromConfig } from './schemas.js';
import type { Schema } from '../../infra/validator.js';
import { NotFoundError, ValidationError } from '../../infra/errors.js';

export class DocumentService {
  private tagIndex = new MultiMap<string, string>();
  private keywordIndex = new MultiMap<string, string>();
  private docs = new Map<string, Document>();
  private idCounter = 0;
  private loaded = false;
  private readonly createSchema: Schema;
  private readonly updateSchema: Schema;

  constructor(
    private store: JsonStore<Document>,
    private logger: Logger,
    private config?: HabitatConfig['documents'],
  ) {
    this.createSchema = createDocumentSchemaFromConfig(config);
    this.updateSchema = updateDocumentSchemaFromConfig(config);
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const all = await this.store.loadAll();
    for (const doc of all) {
      this.indexDoc(doc);
    }
    this.loaded = true;
    this.logger.debug('Documents loaded', { count: this.docs.size });
  }

  private indexDoc(doc: Document): void {
    this.docs.set(doc.id, doc);
    for (const tag of doc.tags) this.tagIndex.add(tag, doc.id);
    for (const kw of doc.keywords) this.keywordIndex.add(kw.toLowerCase(), doc.id);
  }

  private unindexDoc(doc: Document): void {
    this.docs.delete(doc.id);
    for (const tag of doc.tags) this.tagIndex.remove(tag, doc.id);
    for (const kw of doc.keywords) this.keywordIndex.remove(kw.toLowerCase(), doc.id);
  }

  private async removeRefsBy(docId: string, refIds: string[]): Promise<void> {
    for (const refId of refIds) {
      const target = this.docs.get(refId);
      if (target) {
        target.refsBy = target.refsBy.filter((r) => r !== docId);
        await this.store.save(target.id, target);
      } else {
        this.logger.warn('removeRefsBy: target document not found', { docId, refId });
      }
    }
  }

  private async addRefsBy(docId: string, refIds: string[]): Promise<void> {
    for (const refId of refIds) {
      const target = this.docs.get(refId);
      if (target && !target.refsBy.includes(docId)) {
        target.refsBy.push(docId);
        await this.store.save(target.id, target);
      } else if (!target) {
        this.logger.warn('addRefsBy: target document not found', { docId, refId });
      }
    }
  }

  private generateId(): string {
    this.idCounter++;
    const ts = Date.now();
    return `doc-${ts}-${this.idCounter}`;
  }

  private extractKeywords(content: string): string[] {
    if (!content) return [];
    const words = content.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [];
    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config?.maxKeywords ?? 50)
      .map(([w]) => w);
  }

  async create(input: CreateDocumentInput): Promise<Document> {
    await this.ensureLoaded();
    const errors = validate(input as unknown as Record<string, unknown>, this.createSchema);
    if (errors.length > 0) throw new ValidationError('Invalid document', errors);

    if (input.refs) {
      for (const refId of input.refs) {
        if (!this.docs.has(refId)) throw new NotFoundError('Document', refId);
      }
    }

    const now = new Date().toISOString();
    const doc: Document = {
      id: this.generateId(),
      name: input.name,
      summary: input.summary,
      content: input.content ?? '',
      tags: input.tags,
      keywords: input.keywords ?? this.extractKeywords(input.content ?? ''),
      createdAt: now,
      updatedAt: now,
      refs: input.refs ?? [],
      refsBy: [],
    };

    // Update refsBy on referenced docs
    await this.addRefsBy(doc.id, doc.refs);

    this.indexDoc(doc);
    await this.store.save(doc.id, doc);
    this.logger.info('Document created', { id: doc.id });
    return doc;
  }

  async read(id: string, view: 'summary' | 'full' = 'summary'): Promise<Document | DocumentMetadata> {
    await this.ensureLoaded();
    const doc = this.docs.get(id);
    if (!doc) throw new NotFoundError('Document', id);
    return view === 'full' ? doc : toMetadata(doc);
  }

  async update(id: string, input: UpdateDocumentInput): Promise<Document> {
    await this.ensureLoaded();
    const doc = this.docs.get(id);
    if (!doc) throw new NotFoundError('Document', id);

    const errors = validate(input as unknown as Record<string, unknown>, this.updateSchema);
    if (errors.length > 0) throw new ValidationError('Invalid update', errors);

    // Validate refs exist
    if (input.refs) {
      for (const refId of input.refs) {
        if (!this.docs.has(refId)) throw new NotFoundError('Document', refId);
      }
    }

    this.unindexDoc(doc);
    const now = new Date().toISOString();

    // Handle ref changes
    if (input.refs) {
      const oldRefs = new Set(doc.refs);
      const newRefs = new Set(input.refs);

      const removed = [...oldRefs].filter((r) => !newRefs.has(r));
      const added = [...newRefs].filter((r) => !oldRefs.has(r));

      await this.removeRefsBy(id, removed);
      await this.addRefsBy(id, added);

      doc.refs = input.refs;
    }

    if (input.name !== undefined) doc.name = input.name;
    if (input.summary !== undefined) doc.summary = input.summary;
    if (input.content !== undefined) doc.content = input.content;
    if (input.tags !== undefined) doc.tags = input.tags;
    if (input.keywords !== undefined) doc.keywords = input.keywords;
    doc.updatedAt = now;

    this.indexDoc(doc);
    await this.store.save(doc.id, doc);
    this.logger.info('Document updated', { id });
    return doc;
  }

  async delete(id: string): Promise<void> {
    await this.ensureLoaded();
    const doc = this.docs.get(id);
    if (!doc) throw new NotFoundError('Document', id);

    // Clean up refsBy on docs this one references
    await this.removeRefsBy(id, doc.refs);

    // Clean up refs on docs that reference this one
    for (const refById of doc.refsBy) {
      const source = this.docs.get(refById);
      if (source) {
        source.refs = source.refs.filter((r) => r !== id);
        await this.store.save(source.id, source);
      } else {
        this.logger.warn('delete: referencing document not found during cleanup', { id, refById });
      }
    }

    this.unindexDoc(doc);
    await this.store.delete(id);
    this.logger.info('Document deleted', { id });
  }

  async list(opts?: {
    tags?: string[];
    keyword?: string;
    sortBy?: 'name' | 'createdAt' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
    offset?: number;
    limit?: number;
  }): Promise<{ documents: DocumentMetadata[]; total: number }> {
    await this.ensureLoaded();

    let candidateIds: Set<string> | null = null;

    // Filter by tags using index
    if (opts?.tags && opts.tags.length > 0) {
      candidateIds = this.tagIndex.intersect(opts.tags);
    }

    // Filter by keyword using index
    if (opts?.keyword) {
      const kw = opts.keyword.toLowerCase();
      const kwIds = this.keywordIndex.get(kw);
      // Also search name and summary
      const nameIds = new Set<string>();
      for (const [id, doc] of this.docs) {
        if (
          doc.name.toLowerCase().includes(kw) ||
          doc.summary.toLowerCase().includes(kw)
        ) {
          nameIds.add(id);
        }
      }
      const combined = new Set([...kwIds, ...nameIds]);
      if (candidateIds) {
        // Intersect with tag results
        for (const id of candidateIds) {
          if (!combined.has(id)) candidateIds.delete(id);
        }
      } else {
        candidateIds = combined;
      }
    }

    const items = candidateIds
      ? [...candidateIds].map((id) => this.docs.get(id)!).filter(Boolean)
      : [...this.docs.values()];

    const result = query(items, {
      sortBy: opts?.sortBy ?? 'updatedAt',
      sortOrder: opts?.sortOrder ?? 'desc',
      offset: opts?.offset,
      limit: opts?.limit ?? 50,
    });

    return {
      documents: result.results.map(toMetadata),
      total: result.total,
    };
  }

  async graph(
    id: string,
    depth = 1,
  ): Promise<{
    nodes: Array<{ document: DocumentMetadata; depth: number }>;
    edges: Array<{ from: string; to: string; type: 'refs' | 'refsBy' }>;
  }> {
    await this.ensureLoaded();
    const center = this.docs.get(id);
    if (!center) throw new NotFoundError('Document', id);

    const visited = new Set<string>();
    const nodes: Array<{ document: DocumentMetadata; depth: number }> = [];
    const edges: Array<{ from: string; to: string; type: 'refs' | 'refsBy' }> = [];
    const queue: Array<{ id: string; d: number }> = [{ id, d: 0 }];

    while (queue.length > 0) {
      const { id: curId, d } = queue.shift()!;
      if (visited.has(curId)) continue;
      visited.add(curId);

      const doc = this.docs.get(curId);
      if (!doc) continue;
      nodes.push({ document: toMetadata(doc), depth: d });

      if (d < depth) {
        for (const refId of doc.refs) {
          edges.push({ from: curId, to: refId, type: 'refs' });
          if (!visited.has(refId)) queue.push({ id: refId, d: d + 1 });
        }
        for (const refById of doc.refsBy) {
          edges.push({ from: refById, to: curId, type: 'refsBy' });
          if (!visited.has(refById)) queue.push({ id: refById, d: d + 1 });
        }
      }
    }

    return { nodes, edges };
  }

  getCount(): number {
    return this.docs.size;
  }
}