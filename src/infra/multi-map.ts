export class MultiMap<K, V> {
  private map = new Map<K, Set<V>>();

  add(key: K, value: V): void {
    let set = this.map.get(key);
    if (!set) {
      set = new Set();
      this.map.set(key, set);
    }
    set.add(value);
  }

  remove(key: K, value: V): void {
    const set = this.map.get(key);
    if (set) {
      set.delete(value);
      if (set.size === 0) this.map.delete(key);
    }
  }

  get(key: K): ReadonlySet<V> {
    return this.map.get(key) ?? new Set();
  }

  intersect(keys: K[]): Set<V> {
    if (keys.length === 0) return new Set();
    const sets = keys.map((k) => this.map.get(k));
    if (sets.some((s) => !s)) return new Set();
    const [first, ...rest] = sets as Set<V>[];
    const result = new Set(first);
    for (const s of rest) {
      for (const v of result) {
        if (!s.has(v)) result.delete(v);
      }
    }
    return result;
  }

  removeValue(value: V): void {
    for (const [key, set] of this.map) {
      set.delete(value);
      if (set.size === 0) this.map.delete(key);
    }
  }

  keys(): K[] {
    return [...this.map.keys()];
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  count(key: K): number {
    return this.map.get(key)?.size ?? 0;
  }

  clear(): void {
    this.map.clear();
  }
}
