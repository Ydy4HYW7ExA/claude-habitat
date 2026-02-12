/**
 * Async producer-consumer channel for feeding messages to a persistent CC session.
 * SDK query() accepts AsyncIterable<SDKUserMessage> as prompt — this provides that.
 */
export class MessageChannel {
    queue = [];
    waiter = null;
    closed = false;
    push(content) {
        if (this.closed)
            throw new Error('Channel is closed');
        const msg = {
            type: 'user',
            message: { role: 'user', content },
        };
        if (this.waiter) {
            const resolve = this.waiter;
            this.waiter = null;
            resolve({ value: msg, done: false });
        }
        else {
            this.queue.push(msg);
        }
    }
    close() {
        this.closed = true;
        if (this.waiter) {
            const resolve = this.waiter;
            this.waiter = null;
            resolve({ value: undefined, done: true });
        }
    }
    get isClosed() {
        return this.closed;
    }
    [Symbol.asyncIterator]() {
        return {
            next: () => {
                if (this.queue.length > 0) {
                    return Promise.resolve({ value: this.queue.shift(), done: false });
                }
                if (this.closed) {
                    return Promise.resolve({ value: undefined, done: true });
                }
                return new Promise((resolve) => {
                    this.waiter = resolve;
                });
            },
            [Symbol.asyncIterator]() {
                return this;
            },
        };
    }
}
//# sourceMappingURL=message-channel.js.map