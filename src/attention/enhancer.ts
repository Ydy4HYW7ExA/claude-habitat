import type { AttentionInput, AttentionOutput, AttentionStrategy, AttentionContext } from './types.js';

export class AttentionEnhancer {
  private strategies: AttentionStrategy[] = [];

  register(strategy: AttentionStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  unregister(name: string): void {
    this.strategies = this.strategies.filter(s => s.name !== name);
  }

  getStrategies(): AttentionStrategy[] {
    return [...this.strategies];
  }

  async enhance(prompt: string, context: AttentionContext): Promise<AttentionOutput> {
    let current: AttentionOutput = {
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
      } catch (err) {
        // Log and skip failed strategy — don't break the entire pipeline
        console.warn(`[AttentionEnhancer] Strategy '${strategy.name}' failed, skipping:`, err);
      }
    }

    return current;
  }
}
