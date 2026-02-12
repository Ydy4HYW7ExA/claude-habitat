import { PROMPT_BUDGET_RATIO, SYSTEM_BUDGET_RATIO, DEFAULT_MAX_CONTEXT_TOKENS, DEFAULT_CHARS_PER_TOKEN, CHARS_PER_TOKEN_LATIN, CHARS_PER_TOKEN_CJK, CONTEXT_TRUNCATION_NOTICE, } from '../../constants.js';
/** Overhead tokens per conversation turn (role marker, separators, etc.) */
const TURN_OVERHEAD_TOKENS = 4;
/**
 * Priority 50 — Controls context budget by estimating token usage
 * and trimming lower-priority content when over budget.
 */
export class ContextBudgetStrategy {
    name = 'context-budget';
    priority = 50;
    maxTokens;
    constructor(maxTokens = DEFAULT_MAX_CONTEXT_TOKENS) {
        this.maxTokens = maxTokens;
    }
    async enhance(input) {
        const totalEstimate = this.estimateTokens(input);
        if (totalEstimate <= this.maxTokens)
            return input;
        // Trim strategy: reduce prompt content (memories are appended there)
        // Keep system prompt and history intact, trim the prompt body
        const systemTokens = this.estimateText(input.systemPromptAppend);
        const historyTokens = this.estimateHistory(input.conversationHistory);
        const availableForPrompt = this.maxTokens - systemTokens - historyTokens;
        if (availableForPrompt <= 0) {
            // Extreme case: trim history too
            return {
                ...input,
                prompt: this.truncateToTokens(input.prompt, Math.floor(this.maxTokens * PROMPT_BUDGET_RATIO)),
                conversationHistory: input.conversationHistory?.slice(-2),
                systemPromptAppend: this.truncateToTokens(input.systemPromptAppend, Math.floor(this.maxTokens * SYSTEM_BUDGET_RATIO)),
            };
        }
        return {
            ...input,
            prompt: this.truncateToTokens(input.prompt, availableForPrompt),
        };
    }
    estimateTokens(input) {
        return (this.estimateText(input.prompt) +
            this.estimateText(input.systemPromptAppend) +
            this.estimateHistory(input.conversationHistory));
    }
    estimateText(text) {
        if (!text)
            return 0;
        // Rough estimate: ~4 chars per token for English, ~2 for CJK
        const cjkChars = (text.match(/[\u4e00-\u9fff\u3000-\u303f]/g) || []).length;
        const otherChars = text.length - cjkChars;
        return Math.ceil(cjkChars / CHARS_PER_TOKEN_CJK + otherChars / CHARS_PER_TOKEN_LATIN);
    }
    estimateHistory(history) {
        if (!history)
            return 0;
        return history.reduce((sum, turn) => sum + this.estimateText(turn.content) + TURN_OVERHEAD_TOKENS, 0);
    }
    truncateToTokens(text, maxTokens) {
        // Rough truncation based on character estimate
        const estimatedCharsPerToken = DEFAULT_CHARS_PER_TOKEN;
        const maxChars = maxTokens * estimatedCharsPerToken;
        if (text.length <= maxChars)
            return text;
        return text.slice(0, maxChars) + CONTEXT_TRUNCATION_NOTICE;
    }
}
//# sourceMappingURL=context-budget.js.map