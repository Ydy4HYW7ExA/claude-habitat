export interface QueryOptions<T> {
  filters?: Array<(item: T) => boolean>;
  sortBy?: keyof T | ((a: T, b: T) => number);
  sortOrder?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

export interface QueryResult<T> {
  results: T[];
  total: number;
}

export function query<T>(items: T[], options: QueryOptions<T> = {}): QueryResult<T> {
  let filtered = items;

  if (options.filters) {
    for (const fn of options.filters) {
      filtered = filtered.filter(fn);
    }
  }

  const total = filtered.length;

  if (options.sortBy) {
    const order = options.sortOrder === 'desc' ? -1 : 1;
    if (typeof options.sortBy === 'function') {
      const cmp = options.sortBy;
      filtered = [...filtered].sort((a, b) => cmp(a, b) * order);
    } else {
      const key = options.sortBy;
      filtered = [...filtered].sort((a, b) => {
        const va = a[key];
        const vb = b[key];
        if (va < vb) return -1 * order;
        if (va > vb) return 1 * order;
        return 0;
      });
    }
  }

  const offset = options.offset ?? 0;
  const limit = options.limit ?? filtered.length;
  const results = filtered.slice(offset, offset + limit);

  return { results, total };
}
