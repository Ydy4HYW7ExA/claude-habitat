import type { AiClientConfig, AiCallOptions, AiResult } from './types.js';
export declare class AiClient {
    private config;
    constructor(config: AiClientConfig);
    call(prompt: string, options: AiCallOptions): Promise<AiResult>;
}
//# sourceMappingURL=client.d.ts.map