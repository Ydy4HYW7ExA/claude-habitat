/**
 * SessionManager — manages persistent CC sessions for background positions.
 * The dispatcher doesn't go through SessionManager (it spawns claude CLI directly).
 */
import type { AiResult, SdkResultMessage } from './types.js';
import type { Process, Program } from '../position/types.js';
import type { LogFn } from '../types.js';
import { MessageChannel } from './message-channel.js';
import { mapSdkResult } from './result-mapper.js';
import { SESSION_STATUS, SDK_SYSTEM_PROMPT_PRESET, DEFAULT_PERMISSION_MODE, DEFAULT_SETTING_SOURCES, DEFAULT_SEND_TIMEOUT_MS } from '../constants.js';

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

export class SessionManager {
  private sessions = new Map<string, SessionHandle>();

  constructor(private config: SessionManagerConfig) {}

  async startSession(
    position: Process,
    roleTemplate: Program,
    mcpServers: Record<string, unknown>,
  ): Promise<SessionHandle> {
    if (this.sessions.has(position.id)) {
      return this.sessions.get(position.id)!;
    }

    const channel = new MessageChannel();

    const handle: SessionHandle = {
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

  private async startConsumptionLoop(
    handle: SessionHandle,
    position: Process,
    roleTemplate: Program,
    mcpServers: Record<string, unknown>,
  ): Promise<void> {
    try {
      let query: (typeof import('@anthropic-ai/claude-agent-sdk'))['query'];
      try {
        ({ query } = await import('@anthropic-ai/claude-agent-sdk'));
      } catch (err) {
        throw new Error('Claude Agent SDK not installed. Run: npm install @anthropic-ai/claude-agent-sdk', { cause: err });
      }

      const sdkOptions: Record<string, unknown> = {
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
        prompt: handle.inputChannel as Parameters<typeof query>[0]['prompt'],
        options: sdkOptions as Parameters<typeof query>[0]['options'],
      });

      for await (const msg of q) {
        if (msg.type === 'result') {
          const result = mapSdkResult(msg as SdkResultMessage);
          handle.sessionId = result.sessionId;
          if (handle._resolver) {
            const resolve = handle._resolver;
            handle._resolver = null;
            resolve(result);
          }
        }
      }
    } catch (err) {
      this.config.logger('error', `Session loop error for ${handle.positionId}: ${err}`);
      if (handle._rejecter) {
        const reject = handle._rejecter;
        handle._rejecter = null;
        handle._resolver = null;
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      handle.status = SESSION_STATUS.CLOSED;
    }
  }

  async sendAndWait(positionId: string, prompt: string): Promise<AiResult> {
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

    const resultPromise = new Promise<AiResult>((resolve, reject) => {
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
    } finally {
      clearTimeout(timeout);
    }
  }

  getSession(positionId: string): SessionHandle | undefined {
    return this.sessions.get(positionId);
  }

  async stopSession(positionId: string): Promise<void> {
    const handle = this.sessions.get(positionId);
    if (!handle) return;
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

  async stopAll(): Promise<void> {
    for (const [id] of this.sessions) {
      await this.stopSession(id);
    }
  }
}
