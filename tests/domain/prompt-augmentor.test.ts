import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptAugmentor } from '../../src/domain/prompt-augmentor/augmentor.js';
import { Logger } from '../../src/logging/logger.js';
import { SKILL_PROJECT_ITERATE } from '../../src/preset/constants.js';

const logger = new Logger({ level: 'error' });

function makeExtractResponse(keywords: string[], summary: string) {
  return new Response(JSON.stringify({
    content: [{ type: 'text', text: JSON.stringify({ keywords, summary }) }],
  }), { status: 200 });
}

function makeMatchResponse(matchedRules: unknown[], matchedSkills: unknown[]) {
  return new Response(JSON.stringify({
    content: [{ type: 'text', text: JSON.stringify({ matchedRules, matchedSkills }) }],
  }), { status: 200 });
}

const testRules = [
  { name: 'Code Review', description: '代码审查规范' },
  { name: 'Workflow Protocol', description: '多步任务的工作流规范' },
];

const testSkills = [
  { name: 'code-review', description: '代码审查协议' },
  { name: SKILL_PROJECT_ITERATE, description: '工作流迭代协议' },
];

describe('PromptAugmentor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns original prompt when disabled', async () => {
    const aug = new PromptAugmentor({ enabled: false }, logger);
    const result = await aug.augment('hello', testRules, testSkills);
    expect(result.augmentedPrompt).toBe('hello');
    expect(result.originalPrompt).toBe('hello');
  });

  it('returns original prompt when no apiKey', async () => {
    const aug = new PromptAugmentor({ enabled: true }, logger);
    const result = await aug.augment('hello', testRules, testSkills);
    expect(result.augmentedPrompt).toBe('hello');
  });

  it('extracts keywords and summary via LLM-1', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return makeExtractResponse(['refactor', 'auth'], '重构认证模块');
      }
      return makeMatchResponse([], []);
    });

    const aug = new PromptAugmentor({ enabled: true, apiKey: 'k' }, logger);
    const result = await aug.augment('重构认证中间件', testRules, testSkills);
    expect(result.extraction.keywords).toEqual(['refactor', 'auth']);
    expect(result.extraction.summary).toBe('重构认证模块');
  });

  it('matches rules and skills via LLM-2 (two fetch calls)', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return makeExtractResponse(['review', 'code'], 'Review code');
      }
      return makeMatchResponse(
        [{ name: 'Code Review', confidence: 0.9, reasoning: 'relevant' }],
        [{ name: 'code-review', confidence: 0.85, reasoning: 'matches' }],
      );
    });

    const aug = new PromptAugmentor({ enabled: true, apiKey: 'k' }, logger);
    const result = await aug.augment('review my code', testRules, testSkills);

    expect(callCount).toBe(2);
    expect(result.matching.matchedRules).toHaveLength(1);
    expect(result.matching.matchedRules[0].name).toBe('Code Review');
    expect(result.matching.matchedSkills).toHaveLength(1);
    expect(result.matching.matchedSkills[0].name).toBe('code-review');
  });

  it('augmented prompt contains Habitat Context block', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return makeExtractResponse(['review'], 'Review code');
      }
      return makeMatchResponse(
        [{ name: 'Code Review', confidence: 0.9, reasoning: 'relevant' }],
        [{ name: 'code-review', confidence: 0.8, reasoning: 'matches' }],
      );
    });

    const aug = new PromptAugmentor({ enabled: true, apiKey: 'k' }, logger);
    const result = await aug.augment('review my code', testRules, testSkills);

    expect(result.augmentedPrompt).toContain('review my code');
    expect(result.augmentedPrompt).toContain('[Habitat Context]');
    expect(result.augmentedPrompt).toContain('Keywords: review');
    expect(result.augmentedPrompt).toContain('[Matched Rules]');
    expect(result.augmentedPrompt).toContain('code-review (0.8)');
  });

  it('returns original prompt when no matches', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return makeExtractResponse(['random'], 'Something random');
      }
      return makeMatchResponse([], []);
    });

    const aug = new PromptAugmentor({ enabled: true, apiKey: 'k' }, logger);
    const result = await aug.augment('something random', testRules, testSkills);
    expect(result.augmentedPrompt).toBe('something random');
  });

  it('extraction cache prevents duplicate LLM-1 calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return makeExtractResponse(['a'], 'b');
    });

    const aug = new PromptAugmentor({ enabled: true, apiKey: 'k' }, logger);
    // Same prompt twice — but with empty rules/skills so match() skips LLM-2
    await aug.augment('same input', [], []);
    await aug.augment('same input', [], []);

    // Only 1 fetch for extraction (match skipped because empty lists)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('match cache prevents duplicate LLM-2 calls', async () => {
    let callCount = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount % 2 === 1) {
        return makeExtractResponse(['x'], 'y');
      }
      return makeMatchResponse([], []);
    });

    const aug = new PromptAugmentor({ enabled: true, apiKey: 'k' }, logger);
    await aug.augment('same input', testRules, testSkills);
    await aug.augment('same input', testRules, testSkills);

    // 1 extract (cached) + 1 match (cached) = 2 total
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('passthrough on LLM failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));

    const aug = new PromptAugmentor({ enabled: true, apiKey: 'k' }, logger);
    const result = await aug.augment('hello', testRules, testSkills);
    expect(result.augmentedPrompt).toBe('hello');
  });

  it('passthrough on non-200 status', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response('error', { status: 500 }),
    );

    const aug = new PromptAugmentor({ enabled: true, apiKey: 'k' }, logger);
    const result = await aug.augment('hello', testRules, testSkills);
    // extract returns empty → match returns empty → no augmentation
    expect(result.augmentedPrompt).toBe('hello');
  });

  it('invalidateCache() clears both caches', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount % 2 === 1) {
        return makeExtractResponse(['a'], 'b');
      }
      return makeMatchResponse([], []);
    });

    const aug = new PromptAugmentor({ enabled: true, apiKey: 'k' }, logger);
    await aug.augment('test', testRules, testSkills);
    expect(callCount).toBe(2);

    aug.invalidateCache();
    await aug.augment('test', testRules, testSkills);
    expect(callCount).toBe(4);
  });

  it('filters matches below confidence threshold', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return makeExtractResponse(['x'], 'y');
      }
      return makeMatchResponse(
        [{ name: 'Code Review', confidence: 0.3, reasoning: 'weak' }],
        [{ name: 'code-review', confidence: 0.4, reasoning: 'weak' }],
      );
    });

    const aug = new PromptAugmentor({ enabled: true, apiKey: 'k', confidenceThreshold: 0.6 }, logger);
    const result = await aug.augment('test', testRules, testSkills);
    expect(result.matching.matchedRules).toHaveLength(0);
    expect(result.matching.matchedSkills).toHaveLength(0);
    expect(result.augmentedPrompt).toBe('test');
  });

  it('parseExtraction catch: returns empty on broken JSON in extraction response', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // Text that matches /{[\s\S]*}/ but fails JSON.parse
        return new Response(JSON.stringify({
          content: [{ type: 'text', text: '{ broken: json, }' }],
        }), { status: 200 });
      }
      return makeMatchResponse([], []);
    });

    const aug = new PromptAugmentor({ enabled: true, apiKey: 'k' }, logger);
    const result = await aug.augment('test', testRules, testSkills);
    expect(result.extraction.keywords).toEqual([]);
    expect(result.extraction.summary).toBe('');
  });

  it('parseMatching catch: returns empty on broken JSON in matching response', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return makeExtractResponse(['a'], 'b');
      }
      // Text that matches /{[\s\S]*}/ but fails JSON.parse
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: '{ broken: json, }' }],
      }), { status: 200 });
    });

    const aug = new PromptAugmentor({ enabled: true, apiKey: 'k' }, logger);
    const result = await aug.augment('test', testRules, testSkills);
    expect(result.matching.matchedRules).toEqual([]);
    expect(result.matching.matchedSkills).toEqual([]);
  });
});
