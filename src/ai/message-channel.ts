/**
 * Async producer-consumer channel for feeding messages to a persistent CC session.
 * SDK query() accepts AsyncIterable<SDKUserMessage> as prompt — this provides that.
 */

export interface SDKUserMessage {
  type: 'user';
  message: { role: 'user'; content: string };
}

export class MessageChannel implements AsyncIterable<SDKUserMessage> {
  private queue: SDKUserMessage[] = [];
  private waiter: ((value: IteratorResult<SDKUserMessage>) => void) | null = null;
  private closed = false;

  push(content: string): void {
    if (this.closed) throw new Error('Channel is closed');
    const msg: SDKUserMessage = {
      type: 'user',
      message: { role: 'user', content },
    };
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = null;
      resolve({ value: msg, done: false });
    } else {
      this.queue.push(msg);
    }
  }

  close(): void {
    this.closed = true;
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = null;
      resolve({ value: undefined as unknown as SDKUserMessage, done: true });
    }
  }

  get isClosed(): boolean {
    return this.closed;
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<SDKUserMessage> {
    return {
      next: (): Promise<IteratorResult<SDKUserMessage>> => {
        if (this.queue.length > 0) {
          return Promise.resolve({ value: this.queue.shift()!, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined as unknown as SDKUserMessage, done: true });
        }
        return new Promise<IteratorResult<SDKUserMessage>>((resolve) => {
          this.waiter = resolve;
        });
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }
}
