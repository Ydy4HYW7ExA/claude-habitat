/**
 * Counting semaphore for concurrency control.
 */
export class Semaphore {
  private current = 0;
  private queue: (() => void)[] = [];

  constructor(private max: number) {
    if (max < 1) throw new Error('Semaphore max must be >= 1');
  }

  get available(): number {
    return this.max - this.current;
  }

  get waiting(): number {
    return this.queue.length;
  }

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      // Don't decrement — the slot transfers to the next waiter
      next();
    } else {
      this.current--;
    }
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
