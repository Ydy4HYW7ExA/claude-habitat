import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPromptAugmentationHook } from '../../src/domain/hook/prompt-augmentation.js';
import { PromptAugmentor } from '../../src/domain/prompt-augmentor/augmentor.js';
import { RuleEngine } from '../../src/domain/rule/engine.js';
import { SessionTracker } from '../../src/domain/session/tracker.js';
import { Logger } from '../../src/logging/logger.js';
import type { HookContext } from '../../src/domain/hook/types.js';

const logger = new Logger({ level: 'error' });

function makeDeps() {
  const augmentor = new PromptAugmentor({ enabled: false }, logger);
  const ruleEngine = new RuleEngine(logger);
  const sessionTracker = new SessionTracker(logger);
  return { promptAugmentor: augmentor, ruleEngine, sessionTracker, skillsDir: '/tmp/nonexistent', logger };
}

describe('PromptAugmentationHook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls augmentor and sets ctx.data.augmentedPrompt', async () => {
    const deps = makeDeps();
    vi.spyOn(deps.promptAugmentor, 'augment').mockResolvedValue({
      originalPrompt: 'hello',
      extraction: { keywords: ['hello'], summary: 'greeting' },
      matching: { matchedRules: [], matchedSkills: [] },
      augmentedPrompt: 'hello\n---\n[Habitat Context]\nKeywords: hello',
    });

    const hook = createPromptAugmentationHook(deps);
    const ctx: HookContext = { event: 'before:prompt', data: { prompt: 'hello' } };
    await hook.handler(ctx);

    expect(ctx.data?.augmentedPrompt).toContain('[Habitat Context]');
    expect(deps.promptAugmentor.augment).toHaveBeenCalledOnce();
  });

  it('records matched rules in SessionTracker', async () => {
    const deps = makeDeps();
    vi.spyOn(deps.promptAugmentor, 'augment').mockResolvedValue({
      originalPrompt: 'review code',
      extraction: { keywords: ['review'], summary: 'review' },
      matching: {
        matchedRules: [{ name: 'Code Review', confidence: 0.9, reasoning: 'relevant' }],
        matchedSkills: [{ name: 'code-review', confidence: 0.8, reasoning: 'matches' }],
      },
      augmentedPrompt: 'augmented',
    });

    const hook = createPromptAugmentationHook(deps);
    const ctx: HookContext = { event: 'before:prompt', data: { prompt: 'review code' } };
    await hook.handler(ctx);

    const stats = deps.sessionTracker.getStats();
    expect(stats.ruleTriggers.get('Code Review')).toBe(1);
  });

  it('sets augmentedPrompt to original on augmentor failure', async () => {
    const deps = makeDeps();
    vi.spyOn(deps.promptAugmentor, 'augment').mockRejectedValue(new Error('boom'));

    const hook = createPromptAugmentationHook(deps);
    const ctx: HookContext = { event: 'before:prompt', data: { prompt: 'hello' } };
    await hook.handler(ctx);

    expect(ctx.data?.augmentedPrompt).toBe('hello');
  });

  it('sets augmentedPrompt to original on non-Error throw', async () => {
    const deps = makeDeps();
    vi.spyOn(deps.promptAugmentor, 'augment').mockRejectedValue('string error');

    const hook = createPromptAugmentationHook(deps);
    const ctx: HookContext = { event: 'before:prompt', data: { prompt: 'hi' } };
    await hook.handler(ctx);

    expect(ctx.data?.augmentedPrompt).toBe('hi');
  });

  it('does nothing when ctx.data.prompt is missing', async () => {
    const deps = makeDeps();
    const spy = vi.spyOn(deps.promptAugmentor, 'augment');

    const hook = createPromptAugmentationHook(deps);
    const ctx: HookContext = { event: 'before:prompt', data: {} };
    await hook.handler(ctx);

    expect(spy).not.toHaveBeenCalled();
    expect(ctx.data?.augmentedPrompt).toBeUndefined();
  });

  it('invalidateSkillCache() clears cached skills', async () => {
    const deps = makeDeps();
    vi.spyOn(deps.promptAugmentor, 'augment').mockResolvedValue({
      originalPrompt: 'x',
      extraction: { keywords: [], summary: '' },
      matching: { matchedRules: [], matchedSkills: [] },
      augmentedPrompt: 'x',
    });

    const hook = createPromptAugmentationHook(deps);
    const ctx1: HookContext = { event: 'before:prompt', data: { prompt: 'x' } };
    await hook.handler(ctx1);

    // invalidateSkillCache should be callable without error
    hook.invalidateSkillCache();

    const ctx2: HookContext = { event: 'before:prompt', data: { prompt: 'x' } };
    await hook.handler(ctx2);

    // augment called twice (skills reloaded after invalidation)
    expect(deps.promptAugmentor.augment).toHaveBeenCalledTimes(2);
  });
});