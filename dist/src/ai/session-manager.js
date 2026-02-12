import { MessageChannel } from './message-channel.js';
import { mapSdkResult } from './result-mapper.js';
import { SESSION_STATUS, SDK_SYSTEM_PROMPT_PRESET, DEFAULT_PERMISSION_MODE, DEFAULT_SETTING_SOURCES, DEFAULT_SEND_TIMEOUT_MS } from '../constants.js';
export class SessionManager {
    config;
    sessions = new Map();
    constructor(config) {
        this.config = config;
    }
    async startSession(position, roleTemplate, mcpServers) {
        if (this.sessions.has(position.id)) {
            return this.sessions.get(position.id);
        }
        const channel = new MessageChannel();
        const handle = {
            positionId: position.id,
            sessionId: '',
            inputChannel: channel,
            status: SESSION_STATUS.STARTING,
            resultPromise: null,
            _resolver: null,
            _rejecter: null,
        };
        this.sessions.set(position.id, handle);
        // Start background consumption loop (fire-and-forget, errors handled internally)
        this.startConsumptionLoop(handle, position, roleTemplate, mcpServers).catch(() => {
            // Errors are already handled inside startConsumptionLoop;
            // this catch prevents unhandled rejection warnings.
        });
        handle.status = SESSION_STATUS.READY;
        return handle;
    }
    async startConsumptionLoop(handle, position, roleTemplate, mcpServers) {
        try {
            let query;
            try {
                ({ query } = await import('@anthropic-ai/claude-agent-sdk'));
            }
            catch (err) {
                throw new Error('Claude Agent SDK not installed. Run: npm install @anthropic-ai/claude-agent-sdk', { cause: err });
            }
            const sdkOptions = {
                systemPrompt: {
                    type: 'preset',
                    preset: SDK_SYSTEM_PROMPT_PRESET,
                    ...(roleTemplate.systemPromptAppend ? { append: roleTemplate.systemPromptAppend } : {}),
                },
                cwd: position.workDir,
                model: roleTemplate.model ?? this.config.defaultModel,
                maxTurns: roleTemplate.maxTurns ?? this.config.defaultMaxTurns,
                maxBudgetUsd: this.config.defaultMaxBudgetUsd,
                permissionMode: roleTemplate.permissionMode ?? DEFAULT_PERMISSION_MODE,
                allowDangerouslySkipPermissions: true,
                settingSources: [...DEFAULT_SETTING_SOURCES],
                persistSession: true,
                mcpServers,
            };
            const q = query({
                // SDK accepts AsyncIterable as prompt for persistent sessions
                prompt: handle.inputChannel,
                options: sdkOptions,
            });
            for await (const msg of q) {
                if (msg.type === 'result') {
                    const result = mapSdkResult(msg);
                    handle.sessionId = result.sessionId;
                    if (handle._resolver) {
                        const resolve = handle._resolver;
                        handle._resolver = null;
                        resolve(result);
                    }
                }
            }
        }
        catch (err) {
            this.config.logger('error', `Session loop error for ${handle.positionId}: ${err}`);
            if (handle._rejecter) {
                const reject = handle._rejecter;
                handle._rejecter = null;
                handle._resolver = null;
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        }
        finally {
            handle.status = SESSION_STATUS.CLOSED;
        }
    }
    async sendAndWait(positionId, prompt) {
        const handle = this.sessions.get(positionId);
        if (!handle) {
            throw new Error(`No session for position: ${positionId}`);
        }
        if (handle.status === SESSION_STATUS.BUSY) {
            throw new Error(`Session for ${positionId} is busy`);
        }
        if (handle.status === SESSION_STATUS.CLOSED) {
            throw new Error(`Session for ${positionId} is closed`);
        }
        handle.status = SESSION_STATUS.BUSY;
        const resultPromise = new Promise((resolve, reject) => {
            handle._resolver = resolve;
            handle._rejecter = reject;
        });
        handle.resultPromise = resultPromise;
        // Timeout guard to prevent infinite hang
        const timeout = setTimeout(() => {
            if (handle._rejecter) {
                const reject = handle._rejecter;
                handle._rejecter = null;
                handle._resolver = null;
                handle.status = SESSION_STATUS.READY;
                handle.resultPromise = null;
                reject(new Error(`sendAndWait timed out for ${positionId} after ${DEFAULT_SEND_TIMEOUT_MS}ms`));
            }
        }, DEFAULT_SEND_TIMEOUT_MS);
        handle.inputChannel.push(prompt);
        try {
            const result = await resultPromise;
            handle.status = SESSION_STATUS.READY;
            handle.resultPromise = null;
            return result;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    getSession(positionId) {
        return this.sessions.get(positionId);
    }
    async stopSession(positionId) {
        const handle = this.sessions.get(positionId);
        if (!handle)
            return;
        // Reject any pending promise before closing
        if (handle._rejecter) {
            const reject = handle._rejecter;
            handle._rejecter = null;
            handle._resolver = null;
            reject(new Error(`Session stopped for ${positionId}`));
        }
        handle.inputChannel.close();
        handle.status = SESSION_STATUS.CLOSED;
        this.sessions.delete(positionId);
    }
    async stopAll() {
        for (const [id] of this.sessions) {
            await this.stopSession(id);
        }
    }
}
//# sourceMappingURL=session-manager.js.map