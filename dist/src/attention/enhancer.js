export class AttentionEnhancer {
    strategies = [];
    register(strategy) {
        this.strategies.push(strategy);
        this.strategies.sort((a, b) => a.priority - b.priority);
    }
    unregister(name) {
        this.strategies = this.strategies.filter(s => s.name !== name);
    }
    getStrategies() {
        return [...this.strategies];
    }
    async enhance(prompt, context) {
        let current = {
            prompt,
            systemPromptAppend: '',
            conversationHistory: undefined,
        };
        for (const strategy of this.strategies) {
            try {
                current = await strategy.enhance({
                    ...current,
                    context,
                });
            }
            catch (err) {
                // Log and skip failed strategy — don't break the entire pipeline
                console.warn(`[AttentionEnhancer] Strategy '${strategy.name}' failed, skipping:`, err);
            }
        }
        return current;
    }
}
//# sourceMappingURL=enhancer.js.map