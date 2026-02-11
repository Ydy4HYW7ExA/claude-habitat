export interface Document {
  id: string;
  name: string;
  summary: string;
  content: string;
  tags: string[];
  keywords: string[];
  /** ISO 8601 string — documents use string timestamps for JSON serialization compatibility */
  createdAt: string;
  /** ISO 8601 string — documents use string timestamps for JSON serialization compatibility */
  updatedAt: string;
  refs: string[];
  refsBy: string[];
}

export interface DocumentMetadata {
  id: string;
  name: string;
  summary: string;
  tags: string[];
  keywords: string[];
  createdAt: string;
  updatedAt: string;
  refCount: number;
  refsByCount: number;
}

export interface CreateDocumentInput {
  name: string;
  summary: string;
  content?: string;
  tags: string[];
  keywords?: string[];
  refs?: string[];
}

export interface UpdateDocumentInput {
  name?: string;
  summary?: string;
  content?: string;
  tags?: string[];
  keywords?: string[];
  refs?: string[];
}

export function toMetadata(doc: Document): DocumentMetadata {
  return {
    id: doc.id,
    name: doc.name,
    summary: doc.summary,
    tags: doc.tags,
    keywords: doc.keywords,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    refCount: doc.refs.length,
    refsByCount: doc.refsBy.length,
  };
}
