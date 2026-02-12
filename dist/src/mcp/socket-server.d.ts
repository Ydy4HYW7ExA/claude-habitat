export interface SocketServerConfig {
    socketPath: string;
    handlers: Record<string, (args: unknown) => Promise<unknown>>;
    logger: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
}
export declare class SocketServer {
    private config;
    private server;
    private connections;
    constructor(config: SocketServerConfig);
    start(): Promise<void>;
    private handleMessage;
    stop(): Promise<void>;
}
//# sourceMappingURL=socket-server.d.ts.map