/**
 * Counting semaphore for concurrency control.
 */
export class Semaphore {
    max;
    current = 0;
    queue = [];
    constructor(max) {
        this.max = max;
        if (max < 1)
            throw new Error('Semaphore max must be >= 1');
    }
    get available() {
        return this.max - this.current;
    }
    get waiting() {
        return this.queue.length;
    }
    async acquire() {
        if (this.current < this.max) {
            this.current++;
            return;
        }
        return new Promise((resolve) => {
            this.queue.push(resolve);
        });
    }
    release() {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            // Don't decrement — the slot transfers to the next waiter
            next();
        }
        else {
            this.current--;
        }
    }
    async withLock(fn) {
        await this.acquire();
        try {
            return await fn();
        }
        finally {
            this.release();
        }
    }
}
//# sourceMappingURL=semaphore.js.map