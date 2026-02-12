/**
 * Async producer-consumer channel for feeding messages to a persistent CC session.
 * SDK query() accepts AsyncIterable<SDKUserMessage> as prompt — this provides that.
 */
export interface SDKUserMessage {
    type: 'user';
    message: {
        role: 'user';
        content: string;
    };
}
export declare class MessageChannel implements AsyncIterable<SDKUserMessage> {
    private queue;
    private waiter;
    private closed;
    push(content: string): void;
    close(): void;
    get isClosed(): boolean;
    [Symbol.asyncIterator](): AsyncIterableIterator<SDKUserMessage>;
}
//# sourceMappingURL=message-channel.d.ts.map