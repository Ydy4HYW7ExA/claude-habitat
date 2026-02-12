import { describe, it, expect } from 'vitest';
import { Semaphore } from '../../src/orchestration/semaphore.js';

describe('Semaphore', () => {
  it('should throw if max < 1', () => {
    expect(() => new Semaphore(0)).toThrow('Semaphore max must be >= 1');
  });

  it('should allow immediate acquisition when slots available', async () => {
    const sem = new Semaphore(2);
    expect(sem.available).toBe(2);

    await sem.acquire();
    expect(sem.available).toBe(1);

    await sem.acquire();
    expect(sem.available).toBe(0);
  });

  it('should queue when no slots available', async () => {
    const sem = new Semaphore(1);
    await sem.acquire();

    let acquired = false;
    const promise = sem.acquire().then(() => { acquired = true; });

    // Should not have acquired yet
    await new Promise(r => setTimeout(r, 10));
    expect(acquired).toBe(false);
    expect(sem.waiting).toBe(1);

    // Release should unblock the waiter
    sem.release();
    await promise;
    expect(acquired).toBe(true);
  });

  it('should release slots correctly', async () => {
    const sem = new Semaphore(2);
    await sem.acquire();
    await sem.acquire();
    expect(sem.available).toBe(0);

    sem.release();
    expect(sem.available).toBe(1);

    sem.release();
    expect(sem.available).toBe(2);
  });

  it('should process waiters in FIFO order', async () => {
    const sem = new Semaphore(1);
    await sem.acquire();

    const order: number[] = [];
    const p1 = sem.acquire().then(() => order.push(1));
    const p2 = sem.acquire().then(() => order.push(2));

    sem.release();
    await p1;
    sem.release();
    await p2;

    expect(order).toEqual([1, 2]);
  });

  it('should work with withLock helper', async () => {
    const sem = new Semaphore(1);
    let running = 0;
    let maxRunning = 0;

    const task = async () => {
      return sem.withLock(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise(r => setTimeout(r, 10));
        running--;
        return 'done';
      });
    };

    const results = await Promise.all([task(), task(), task()]);

    expect(maxRunning).toBe(1);
    expect(results).toEqual(['done', 'done', 'done']);
  });

  it('should release on error in withLock', async () => {
    const sem = new Semaphore(1);

    await expect(
      sem.withLock(async () => { throw new Error('fail'); })
    ).rejects.toThrow('fail');

    // Slot should be released
    expect(sem.available).toBe(1);
  });

  it('should report waiting count', async () => {
    const sem = new Semaphore(1);
    await sem.acquire();

    expect(sem.waiting).toBe(0);

    const p1 = sem.acquire();
    const p2 = sem.acquire();

    expect(sem.waiting).toBe(2);

    sem.release();
    await p1;
    expect(sem.waiting).toBe(1);

    sem.release();
    await p2;
    expect(sem.waiting).toBe(0);
  });
});
