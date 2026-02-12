import type { AiClientConfig, AiCallOptions, AiResult, SdkResultMessage } from './types.js';
import { mapSdkResult } from './result-mapper.js';
import { SDK_SYSTEM_PROMPT_PRESET, DEFAULT_PERMISSION_MODE, DEFAULT_SETTING_SOURCES } from '../constants.js';

export class AiClient {
  constructor(private config: AiClientConfig) {}

  async call(prompt: string, options: AiCallOptions): Promise<AiResult> {
    // Dynamic import to avoid hard dependency at module load time
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
        ...(options.systemPromptAppend ? { append: options.systemPromptAppend } : {}),
      },
      cwd: options.cwd ?? this.config.projectRoot,
      model: options.model ?? this.config.defaultModel,
      maxTurns: options.maxTurns ?? this.config.defaultMaxTurns,
      maxBudgetUsd: options.maxBudgetUsd ?? this.config.defaultMaxBudgetUsd,
      permissionMode: options.permissionMode ?? DEFAULT_PERMISSION_MODE,
      allowDangerouslySkipPermissions: true,
      settingSources: [...DEFAULT_SETTING_SOURCES],
      persistSession: true,
      ...(options.allowedTools ? { allowedTools: options.allowedTools } : {}),
      ...(options.disallowedTools ? { disallowedTools: options.disallowedTools } : {}),
      ...(options.mcpServers ? { mcpServers: options.mcpServers } : {}),
      ...(options.outputFormat ? { outputFormat: options.outputFormat } : {}),
      ...(options.resume ? { resume: options.resume } : {}),
      ...(options.fork ? { forkSession: options.fork } : {}),
      ...(options.hooks ? { hooks: options.hooks } : {}),
      ...(options.abortController ? { abortController: options.abortController } : {}),
    };

    // SDK query() accepts Record<string, unknown> options
    const q = query({ prompt, options: sdkOptions as Parameters<typeof query>[0]['options'] });
    let result: AiResult | undefined;

    for await (const message of q) {
      if (message.type === 'result') {
        result = mapSdkResult(message as SdkResultMessage);
      }
    }

    if (!result) {
      return {
        text: '',
        sessionId: '',
        costUsd: 0,
        durationMs: 0,
        numTurns: 0,
        status: 'error',
        error: 'No result message received from SDK',
      };
    }

    return result;
  }
}
