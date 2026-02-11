import { createHash } from 'node:crypto';
import type { Logger } from '../../logging/logger.js';
import type {
  PromptAugmentorConfig,
  ExtractionResult,
  MatchingResult,
  MatchItem,
  AugmentationResult,
  AbbreviatedRule,
  AbbreviatedSkill,
} from './types.js';

export class PromptAugmentor {
  private extractCache = new Map<string, ExtractionResult>();
  private matchCache = new Map<string, MatchingResult>();

  private readonly model: string;
  private readonly endpoint: string;
  private readonly confidenceThreshold: number;
  private readonly maxMatchedRules: number;
  private readonly maxMatchedSkills: number;
  private readonly enabled: boolean;
  private readonly timeoutMs: number;

  constructor(
    private config: PromptAugmentorConfig,
    private logger: Logger,
  ) {
    this.model = config.model ?? 'claude-sonnet-4-5';
    this.endpoint = config.endpoint ?? 'https://api.anthropic.com';
    this.confidenceThreshold = config.confidenceThreshold ?? 0.6;
    this.maxMatchedRules = config.maxMatchedRules ?? 5;
    this.maxMatchedSkills = config.maxMatchedSkills ?? 3;
    this.enabled = config.enabled ?? true;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  async augment(
    prompt: string,
    rules: AbbreviatedRule[],
    skills: AbbreviatedSkill[],
  ): Promise<AugmentationResult> {
    if (!this.enabled || !this.config.apiKey) {
      return this.passthrough(prompt);
    }

    try {
      const extraction = await this.extract(prompt);
      const matching = await this.match(extraction, rules, skills);
      const augmentedPrompt = this.formatAugmentedPrompt(prompt, extraction, matching);

      return {
        originalPrompt: prompt,
        extraction,
        matching,
        augmentedPrompt,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('PromptAugmentor: augment failed, passthrough', { error: msg });
      return this.passthrough(prompt);
    }
  }

  invalidateCache(): void {
    this.extractCache.clear();
    this.matchCache.clear();
  }

  // --- private ---

  private passthrough(prompt: string): AugmentationResult {
    return {
      originalPrompt: prompt,
      extraction: { keywords: [], summary: '' },
      matching: { matchedRules: [], matchedSkills: [] },
      augmentedPrompt: prompt,
    };
  }

  private async extract(prompt: string): Promise<ExtractionResult> {
    const cacheKey = 'extract:' + createHash('sha256').update(prompt).digest('hex').slice(0, 16);
    const cached = this.extractCache.get(cacheKey);
    if (cached) return cached;

    const body = JSON.stringify({
      model: this.model,
      max_tokens: 512,
      system: EXTRACT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = await this.fetchLLM(body);
    const result = this.parseExtraction(text);
    this.extractCache.set(cacheKey, result);
    return result;
  }

  private async match(
    extraction: ExtractionResult,
    rules: AbbreviatedRule[],
    skills: AbbreviatedSkill[],
  ): Promise<MatchingResult> {
    if (rules.length === 0 && skills.length === 0) {
      return { matchedRules: [], matchedSkills: [] };
    }

    const ruleNames = rules.map(r => r.name).sort().join(',');
    const skillNames = skills.map(s => s.name).sort().join(',');
    const raw = extraction.keywords.join(',') + '\0' + extraction.summary + '\0' + ruleNames + '\0' + skillNames;
    const cacheKey = 'match:' + createHash('sha256').update(raw).digest('hex').slice(0, 16);
    const cached = this.matchCache.get(cacheKey);
    if (cached) return cached;

    const extractedKws = new Set(extraction.keywords.map(k => k.toLowerCase()));
    const ruleList = rules.map(r => {
      const hint = r.keywords?.some(kw => extractedKws.has(kw.toLowerCase())) ? ' [keyword-match]' : '';
      return `- ${r.name}: ${r.description}${hint}`;
    }).join('\n');
    const skillList = skills.map(s => `- ${s.name}: ${s.description}`).join('\n');

    const userMessage =
      `Keywords: ${extraction.keywords.join(', ')}\n` +
      `Summary: ${extraction.summary}\n\n` +
      `Rules:\n${ruleList}\n\n` +
      `Skills:\n${skillList}`;

    const body = JSON.stringify({
      model: this.model,
      max_tokens: 1024,
      system: MATCH_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = await this.fetchLLM(body);
    const result = this.parseMatching(text);
    this.matchCache.set(cacheKey, result);
    return result;
  }

  private formatAugmentedPrompt(
    prompt: string,
    extraction: ExtractionResult,
    matching: MatchingResult,
  ): string {
    const hasRules = matching.matchedRules.length > 0;
    const hasSkills = matching.matchedSkills.length > 0;

    if (!hasRules && !hasSkills) return prompt;

    const lines: string[] = [
      prompt,
      '',
      '---',
      '[Habitat Context]',
      `Keywords: ${extraction.keywords.join(', ')}`,
      `Summary: ${extraction.summary}`,
    ];

    if (hasRules) {
      lines.push('');
      lines.push('[Matched Rules]');
      for (const r of matching.matchedRules) {
        lines.push(`- ${r.name} (${r.confidence}): ${r.reasoning}`);
      }
    }

    if (hasSkills) {
      lines.push('');
      lines.push('[Matched Skills]');
      for (const s of matching.matchedSkills) {
        lines.push(`- ${s.name} (${s.confidence}): ${s.reasoning}`);
      }
    }

    return lines.join('\n');
  }

  private async fetchLLM(body: string): Promise<string> {
    const url = `${this.endpoint}/v1/messages`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey!,
          'anthropic-version': '2023-06-01',
        },
        signal: controller.signal,
        body,
      });

      if (!resp.ok) {
        this.logger.error('PromptAugmentor: API error', { status: resp.status });
        return '';
      }

      const data = (await resp.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      return data.content?.[0]?.text ?? '';
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseExtraction(text: string): ExtractionResult {
    try {
      const jsonStr = extractTopLevelJson(text);
      if (!jsonStr) return { keywords: [], summary: '' };

      const parsed = JSON.parse(jsonStr) as {
        keywords?: string[];
        summary?: string;
      };

      return {
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      };
    } catch {
      this.logger.error('PromptAugmentor: failed to parse extraction response');
      return { keywords: [], summary: '' };
    }
  }

  private parseMatching(text: string): MatchingResult {
    try {
      const jsonStr = extractTopLevelJson(text);
      if (!jsonStr) return { matchedRules: [], matchedSkills: [] };

      const parsed = JSON.parse(jsonStr) as {
        matchedRules?: Array<{ name?: string; confidence?: number; reasoning?: string }>;
        matchedSkills?: Array<{ name?: string; confidence?: number; reasoning?: string }>;
      };

      const filterAndLimit = (
        items: Array<{ name?: string; confidence?: number; reasoning?: string }> | undefined,
        max: number,
      ): MatchItem[] => {
        if (!Array.isArray(items)) return [];
        return items
          .filter(
            (item) =>
              typeof item.name === 'string' &&
              typeof item.confidence === 'number' &&
              item.confidence >= this.confidenceThreshold,
          )
          .slice(0, max)
          .map((item) => ({
            name: item.name!,
            confidence: item.confidence!,
            reasoning: item.reasoning ?? '',
          }));
      };

      return {
        matchedRules: filterAndLimit(parsed.matchedRules, this.maxMatchedRules),
        matchedSkills: filterAndLimit(parsed.matchedSkills, this.maxMatchedSkills),
      };
    } catch {
      this.logger.error('PromptAugmentor: failed to parse matching response');
      return { matchedRules: [], matchedSkills: [] };
    }
  }
}

const EXTRACT_SYSTEM_PROMPT =
  '你是关键词和摘要提取器。给定用户输入，提取：\n' +
  '1. keywords: 3-8 个捕捉意图的关键词/短语\n' +
  '2. summary: 一句话总结用户想做什么\n' +
  '只返回 JSON 对象 {"keywords": [...], "summary": "..."}，不要其他文字。';

const MATCH_SYSTEM_PROMPT =
  '你是 rule 和 skill 匹配器。给定关键词、摘要、以及可用的 rule 和 skill 清单，判断哪些相关。\n' +
  '返回 JSON 对象：\n' +
  '- matchedRules: [{name, confidence (0.0-1.0), reasoning}]\n' +
  '- matchedSkills: [{name, confidence (0.0-1.0), reasoning}]\n' +
  '只包含 confidence >= 0.5 的项。无匹配返回空数组。只返回 JSON，不要其他文字。';

function extractTopLevelJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return null;
}
