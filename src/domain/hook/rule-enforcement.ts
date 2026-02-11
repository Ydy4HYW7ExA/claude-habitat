/** @deprecated Use prompt-augmentor instead */
import type { HookHandler, HookContext } from './types.js';
import type { RuleEngine } from '../rule/engine.js';
import type { SkillMatcher } from '../skill-matcher/matcher.js';
import type { SessionTracker } from '../session/tracker.js';
import type { SkillSummary } from '../skill-matcher/types.js';
import type { Logger } from '../../logging/logger.js';
import { readdirOrEmpty } from '../../infra/fs-utils.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const SKIP_TOOLS = new Set([
  'habitat_skill_resolve', 'habitat_rule_list', 'habitat_rule_read',
  'habitat_command_list', 'habitat_command_read',
  'habitat_skill_list', 'habitat_skill_read',
  'habitat_session_stats',
]);

const MAX_INPUT_LENGTH = 500;

export function createRuleEnforcementHook(deps: {
  ruleEngine: RuleEngine;
  skillMatcher: SkillMatcher;
  sessionTracker: SessionTracker;
  skillsDir: string;
  logger: Logger;
}): HookHandler {
  let cachedSkills: SkillSummary[] | null = null;

  return {
    id: 'builtin:rule-enforcement',
    event: 'after:tool',
    name: 'Rule Enforcement',
    priority: 10,
    async handler(ctx: HookContext) {
      deps.sessionTracker.recordToolCall();

      if (SKIP_TOOLS.has(ctx.toolName ?? '')) return;

      const input = buildEvaluationInput(ctx);
      const matches = deps.ruleEngine.evaluate(input);
      if (matches.length === 0) return;

      const skills = await getAvailableSkills(deps.skillsDir, cachedSkills);
      cachedSkills = skills;

      const hints: { source: string; content: string }[] = [];

      for (const match of matches) {
        const skillResults = await deps.skillMatcher.matchRule(
          buildRuleInput(deps.ruleEngine, match.ruleId),
          skills,
        );
        const skillNames = skillResults.map((s) => s.skillName);

        deps.sessionTracker.recordRuleTrigger({
          ruleId: match.ruleId,
          ruleName: match.ruleName,
          toolName: ctx.toolName ?? 'unknown',
          timestamp: Date.now(),
          matchedSkills: skillNames,
        });

        if (skillNames.length > 0) {
          const skillRefs = skillNames
            .map((s) => `habitat_skill_resolve("${s}")`)
            .join(' or ');
          hints.push({
            source: `rule:${match.ruleId}`,
            content:
              `**Rule "${match.ruleName}" triggered (${match.action}):** ${match.message}\n` +
              `→ Recommended: call ${skillRefs} to load the relevant protocol.`,
          });
        } else {
          hints.push({
            source: `rule:${match.ruleId}`,
            content: `**Rule "${match.ruleName}" triggered (${match.action}):** ${match.message}`,
          });
        }
      }

      if (hints.length > 0) {
        // Discovery fallback: if rules triggered but no habitat_skill_resolve hints, try discoverSkills
        const hasSkillRecommendations = hints.some(h => h.content.includes('habitat_skill_resolve'));

        if (!hasSkillRecommendations) {
          const summary = buildEvaluationInput(ctx);
          const discovered = await deps.skillMatcher.discoverSkills(
            { toolName: ctx.toolName ?? 'unknown', summary },
            skills,
          );
          if (discovered.length > 0) {
            const refs = discovered.map(s => `habitat_skill_resolve("${s.skillName}")`).join(' or ');
            hints.push({
              source: 'discovery',
              content: `→ Suggested skill: call ${refs} (discovered by context matching).`,
            });
          }
        }

        ctx.data = ctx.data ?? {};
        ctx.data.hints = hints.map(e => `## ${e.source}\n\n${e.content}`).join('\n\n---\n\n');
      }
    },
  };

  function buildRuleInput(
    engine: RuleEngine,
    ruleId: string,
  ): { id: string; name: string; description: string; category: string; tags: string[] } {
    const rule = engine.get(ruleId);
    if (!rule) {
      return { id: ruleId, name: ruleId, description: '', category: 'general', tags: [] };
    }
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      category: rule.category,
      tags: rule.tags,
    };
  }
}

/** Invalidate the cached skills list (call after skill CRUD). */
export function invalidateSkillCache(): void {
  // The closure-based cache is per-hook instance.
  // This is handled by the hook's cachedSkills variable being set to null
  // when the hook is re-created, or by the HabitatFileService calling
  // skillMatcher.invalidateCache().
}

function buildEvaluationInput(ctx: HookContext): string {
  const parts: string[] = [];
  if (ctx.toolName) parts.push(`tool:${ctx.toolName}`);
  if (ctx.data?.input) {
    const inputStr = JSON.stringify(ctx.data.input);
    parts.push(inputStr.slice(0, MAX_INPUT_LENGTH));
  }
  return parts.join(' ');
}

async function getAvailableSkills(
  skillsDir: string,
  cached: SkillSummary[] | null,
): Promise<SkillSummary[]> {
  if (cached) return cached;

  try {
    const files = await readdirOrEmpty(skillsDir);
    const skills: SkillSummary[] = [];

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const name = file.replace(/\.md$/, '');
      const content = await fs.readFile(join(skillsDir, file), 'utf-8');
      const { description, tags } = extractSkillMeta(content);
      skills.push({ name, description, tags });
    }

    return skills;
  } catch {
    return [];
  }
}

function extractSkillMeta(content: string): { description: string; tags: string[] } {
  let description = '';
  let tags: string[] = [];

  if (content.startsWith('---')) {
    const endIdx = content.indexOf('---', 3);
    if (endIdx !== -1) {
      const frontmatter = content.slice(3, endIdx);
      const descMatch = frontmatter.match(/^description:\s*"?(.+?)"?\s*$/m);
      if (descMatch) description = descMatch[1];
      const tagsMatch = frontmatter.match(/^tags:\s*\[(.+)\]\s*$/m);
      if (tagsMatch) {
        tags = tagsMatch[1].split(',').map((t) => t.trim());
      }
    }
  }

  return { description, tags };
}
