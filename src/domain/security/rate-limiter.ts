export class RateLimiter {
  private windows = new Map<string, number[]>();

  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {}

  check(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    let timestamps = this.windows.get(key) ?? [];
    timestamps = timestamps.filter((t) => t > cutoff);
    this.windows.set(key, timestamps);
    return timestamps.length < this.maxRequests;
  }

  record(key: string): void {
    const timestamps = this.windows.get(key) ?? [];
    timestamps.push(Date.now());
    this.windows.set(key, timestamps);
  }

  tryAcquire(key: string): boolean {
    if (!this.check(key)) return false;
    this.record(key);
    return true;
  }

  reset(key: string): void {
    this.windows.delete(key);
  }
}
