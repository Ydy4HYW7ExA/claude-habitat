/** @deprecated Use PromptAugmentor instead */
import { createHash } from 'node:crypto';
import type { Logger } from '../../logging/logger.js';
import type { SkillMatchResult, SkillSummary, SkillMatcherConfig } from './types.js';

export class SkillMatcher {
  private cache = new Map<string, SkillMatchResult[]>();

  private readonly model: string;
  private readonly endpoint: string;
  private readonly confidenceThreshold: number;
  private readonly maxSkillsPerRule: number;
  private readonly enabled: boolean;

  constructor(
    private config: SkillMatcherConfig,
    private logger: Logger,
  ) {
    this.model = config.model ?? 'claude-sonnet-4-5';
    this.endpoint = config.endpoint ?? 'https://api.anthropic.com';
    this.confidenceThreshold = config.confidenceThreshold ?? 0.6;
    this.maxSkillsPerRule = config.maxSkillsPerRule ?? 3;
    this.enabled = config.enabled ?? true;
  }

  async matchRule(
    rule: { id: string; name: string; description: string; category: string; tags: string[] },
    availableSkills: SkillSummary[],
  ): Promise<SkillMatchResult[]> {
    if (!this.enabled) return [];
    if (!this.config.apiKey) {
      this.logger.warn('SkillMatcher: no API key configured, returning empty');
      return [];
    }
    if (availableSkills.length === 0) return [];

    const cacheKey = this.buildCacheKey(rule.id, rule.description, availableSkills);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const results = await this.callLLM(rule, availableSkills);
      this.cache.set(cacheKey, results);
      return results;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('SkillMatcher: LLM call failed', { error: msg });
      return [];
    }
  }

  async matchAll(
    rules: Array<{ id: string; name: string; description: string; category: string; tags: string[] }>,
    availableSkills: SkillSummary[],
  ): Promise<Map<string, SkillMatchResult[]>> {
    const result = new Map<string, SkillMatchResult[]>();
    for (const rule of rules) {
      const matches = await this.matchRule(rule, availableSkills);
      result.set(rule.id, matches);
    }
    return result;
  }

  invalidateCache(ruleId?: string): void {
    if (!ruleId) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(ruleId + ':')) {
        this.cache.delete(key);
      }
    }
  }

  async discoverSkills(
    context: { toolName: string; summary: string },
    availableSkills: SkillSummary[],
  ): Promise<SkillMatchResult[]> {
    if (!this.enabled) return [];
    if (!this.config.apiKey) return [];
    if (availableSkills.length === 0) return [];

    const cacheKey = this.buildDiscoverCacheKey(context, availableSkills);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const results = await this.callDiscoverLLM(context, availableSkills);
      this.cache.set(cacheKey, results);
      return results;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('SkillMatcher: discover LLM call failed', { error: msg });
      return [];
    }
  }

  private buildDiscoverCacheKey(
    context: { toolName: string; summary: string },
    skills: SkillSummary[],
  ): string {
    const skillNames = skills.map((s) => s.name).sort().join(',');
    const hash = createHash('sha256')
      .update(context.toolName + context.summary + skillNames)
      .digest('hex')
      .slice(0, 16);
    return `discover:${hash}`;
  }

  private async callDiscoverLLM(
    context: { toolName: string; summary: string },
    availableSkills: SkillSummary[],
  ): Promise<SkillMatchResult[]> {
    const skillList = availableSkills
      .map((s) => `- ${s.name}: ${s.description}`)
      .join('\n');

    const userMessage =
      `Context: tool "${context.toolName}" — ${context.summary}\n\n` +
      `Skills:\n${skillList}`;

    const body = JSON.stringify({
      model: this.model,
      max_tokens: 1024,
      system: DISCOVER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    return this.fetchAndParse(body);
  }

  private buildCacheKey(ruleId: string, description: string, skills: SkillSummary[]): string {
    const skillNames = skills.map((s) => s.name).sort().join(',');
    const hash = createHash('sha256')
      .update(ruleId + description + skillNames)
      .digest('hex')
      .slice(0, 16);
    return `${ruleId}:${hash}`;
  }

  private async callLLM(
    rule: { id: string; name: string; description: string; category: string; tags: string[] },
    availableSkills: SkillSummary[],
  ): Promise<SkillMatchResult[]> {
    const skillList = availableSkills
      .map((s) => `- ${s.name}: ${s.description}`)
      .join('\n');

    const userMessage =
      `Rule: ${rule.name} — ${rule.description}\n\n` +
      `Skills:\n${skillList}`;

    const body = JSON.stringify({
      model: this.model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    return this.fetchAndParse(body);
  }

  private async fetchAndParse(body: string): Promise<SkillMatchResult[]> {
    const url = `${this.endpoint}/v1/messages`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

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
        this.logger.error('SkillMatcher: API error', { status: resp.status });
        return [];
      }

      const data = (await resp.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = data.content?.[0]?.text ?? '';
      return this.parseResponse(text);
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseResponse(text: string): SkillMatchResult[] {
    try {
      // Extract JSON array from response (may be wrapped in markdown code block)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        skillName?: string;
        confidence?: number;
        reasoning?: string;
      }>;

      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(
          (item) =>
            typeof item.skillName === 'string' &&
            typeof item.confidence === 'number' &&
            item.confidence >= this.confidenceThreshold,
        )
        .slice(0, this.maxSkillsPerRule)
        .map((item) => ({
          skillName: item.skillName!,
          confidence: item.confidence!,
          reasoning: item.reasoning ?? '',
        }));
    } catch {
      this.logger.error('SkillMatcher: failed to parse LLM response');
      return [];
    }
  }
}

const SYSTEM_PROMPT = `You are a skill matcher. Given a rule and a list of available skills, determine which skills are most relevant to the rule.

Return a JSON array of matches. Each match has:
- skillName: exact name of the skill
- confidence: 0.0 to 1.0 indicating match strength
- reasoning: brief explanation of why this skill matches

Only include skills with confidence >= 0.5. Return an empty array [] if no skills match.
Return ONLY the JSON array, no other text.`;

const DISCOVER_SYSTEM_PROMPT = `You are a skill discoverer. Given a tool execution context, determine which available skills are most relevant.

Return a JSON array of matches. Each match has:
- skillName: exact name of the skill
- confidence: 0.0 to 1.0 indicating match strength
- reasoning: brief explanation of why this skill is relevant

Only include skills with confidence >= 0.5. Return an empty array [] if no skills match.
Return ONLY the JSON array, no other text.`;
