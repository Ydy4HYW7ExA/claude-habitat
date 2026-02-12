/**
 * SessionManager — manages persistent CC sessions for background positions.
 * The dispatcher doesn't go through SessionManager (it spawns claude CLI directly).
 */
import type { AiResult } from './types.js';
import type { Process, Program } from '../position/types.js';
import type { LogFn } from '../types.js';
import { MessageChannel } from './message-channel.js';
import { SESSION_STATUS } from '../constants.js';
export interface SessionHandle {
    positionId: string;
    sessionId: string;
    inputChannel: MessageChannel;
    status: typeof SESSION_STATUS[keyof typeof SESSION_STATUS];
    resultPromise: Promise<AiResult> | null;
    /** Stored resolver for the current resultPromise */
    _resolver: ((result: AiResult) => void) | null;
    /** Stored rejecter for the current resultPromise */
    _rejecter: ((error: Error) => void) | null;
}
export interface SessionManagerConfig {
    projectRoot: string;
    defaultModel: string;
    defaultMaxTurns: number;
    defaultMaxBudgetUsd: number;
    logger: LogFn;
}
export declare class SessionManager {
    private config;
    private sessions;
    constructor(config: SessionManagerConfig);
    startSession(position: Process, roleTemplate: Program, mcpServers: Record<string, unknown>): Promise<SessionHandle>;
    private startConsumptionLoop;
    sendAndWait(positionId: string, prompt: string): Promise<AiResult>;
    getSession(positionId: string): SessionHandle | undefined;
    stopSession(positionId: string): Promise<void>;
    stopAll(): Promise<void>;
}
//# sourceMappingURL=session-manager.d.ts.map