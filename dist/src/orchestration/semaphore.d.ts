/**
 * Counting semaphore for concurrency control.
 */
export declare class Semaphore {
    private max;
    private current;
    private queue;
    constructor(max: number);
    get available(): number;
    get waiting(): number;
    acquire(): Promise<void>;
    release(): void;
    withLock<T>(fn: () => Promise<T>): Promise<T>;
}
//# sourceMappingURL=semaphore.d.ts.map