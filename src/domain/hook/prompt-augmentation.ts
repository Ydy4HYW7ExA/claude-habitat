import type { HookHandler, HookContext } from './types.js';
import type { PromptAugmentor } from '../prompt-augmentor/augmentor.js';
import type { RuleEngine } from '../rule/engine.js';
import type { SessionTracker } from '../session/tracker.js';
import type { Logger } from '../../logging/logger.js';
import { getAbbreviatedRules, getAbbreviatedSkills } from '../prompt-augmentor/list-providers.js';
import type { AbbreviatedSkill } from '../prompt-augmentor/types.js';

const SKILL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface PromptAugmentationHook extends HookHandler {
  invalidateSkillCache(): void;
}

export function createPromptAugmentationHook(deps: {
  promptAugmentor: PromptAugmentor;
  ruleEngine: RuleEngine;
  sessionTracker: SessionTracker;
  skillsDir: string;
  logger: Logger;
}): PromptAugmentationHook {
  let cachedSkills: AbbreviatedSkill[] | null = null;
  let cachedAt = 0;

  function invalidateSkillCache(): void {
    cachedSkills = null;
    cachedAt = 0;
  }

  async function handler(ctx: HookContext): Promise<void> {
    const prompt = ctx.data?.prompt as string | undefined;
    if (!prompt) return;

    try {
      const rules = getAbbreviatedRules(deps.ruleEngine);

      const now = Date.now();
      if (!cachedSkills || now - cachedAt > SKILL_CACHE_TTL_MS) {
        cachedSkills = await getAbbreviatedSkills(deps.skillsDir);
        cachedAt = now;
      }

      const result = await deps.promptAugmentor.augment(prompt, rules, cachedSkills);

      ctx.data = ctx.data ?? {};
      ctx.data.augmentedPrompt = result.augmentedPrompt;
      ctx.data.augmentationResult = result;

      // Record matched rules in SessionTracker
      for (const rule of result.matching.matchedRules) {
        deps.sessionTracker.recordRuleTrigger({
          ruleId: rule.name,
          ruleName: rule.name,
          toolName: 'prompt-augmentation',
          timestamp: Date.now(),
          matchedSkills: result.matching.matchedSkills.map((s) => s.name),
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      deps.logger.error('PromptAugmentationHook failed, passthrough', { error: msg });
      ctx.data = ctx.data ?? {};
      ctx.data.augmentedPrompt = prompt;
    }
  }

  return {
    id: 'builtin:prompt-augmentation',
    event: 'before:prompt',
    name: 'Prompt Augmentation',
    priority: 10,
    handler,
    invalidateSkillCache,
  };
}
