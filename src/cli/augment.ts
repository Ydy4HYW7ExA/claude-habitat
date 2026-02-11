#!/usr/bin/env node
/**
 * CLI entry point for prompt augmentation.
 * Invoked by Claude Code's UserPromptSubmit hook.
 *
 * Reads hook JSON from stdin, runs the augmentation pipeline,
 * and outputs the habitat context section to stdout (if any matches).
 * Always exits 0 to never block the prompt.
 */

import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { Logger, stderrTransport } from '../logging/logger.js';
import { ConfigLoader } from '../domain/config/loader.js';
import { RuleEngine } from '../domain/rule/engine.js';
import { RuleLoader } from '../domain/rule/loader.js';
import { PromptAugmentor } from '../domain/prompt-augmentor/augmentor.js';
import { getAbbreviatedRules, getAbbreviatedSkills } from '../domain/prompt-augmentor/list-providers.js';
import { HABITAT_DIR, HABITAT_RULES_DIR, HABITAT_SKILLS_DIR } from '../preset/constants.js';

/**
 * Walk up from cwd looking for .claude-habitat/marker.json.
 * Returns the .claude-habitat directory path, or null if not found.
 */
export async function findProjectHabitatDir(startDir?: string): Promise<string | null> {
  let current = startDir ?? process.cwd();

  while (true) {
    const candidate = join(current, '.claude-habitat', 'marker.json');
    try {
      await fs.access(candidate);
      return join(current, '.claude-habitat');
    } catch {
      // not found here, go up
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

async function main(): Promise<void> {
  const logger = new Logger({ level: 'error', context: 'augment-cli' });
  logger.addTransport(stderrTransport);

  try {
    // Read hook JSON from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    const raw = Buffer.concat(chunks).toString('utf-8').trim();
    if (!raw) return;

    const hookData = JSON.parse(raw) as { prompt?: string };
    const prompt = hookData.prompt;
    if (!prompt || typeof prompt !== 'string') return;

    // Detect project-level habitat
    const projectHabitatDir = await findProjectHabitatDir();

    // Load config with fallback chain
    const configLoader = new ConfigLoader();
    const config = projectHabitatDir
      ? await configLoader.loadWithFallback(projectHabitatDir, HABITAT_DIR)
      : await configLoader.load(HABITAT_DIR);

    const augConfig = config.promptAugmentor;
    if (!augConfig?.enabled) return;

    // apiKey fallback: config → ANTHROPIC_AUTH_TOKEN env var
    const apiKey = augConfig.apiKey ?? process.env.ANTHROPIC_AUTH_TOKEN;
    if (!apiKey) return;
    augConfig.apiKey = apiKey;

    // Prefer project-level rules/skills dirs, fall back to global
    const rulesDir = projectHabitatDir
      ? join(projectHabitatDir, 'rules')
      : HABITAT_RULES_DIR;
    const skillsDir = projectHabitatDir
      ? join(projectHabitatDir, 'skills')
      : HABITAT_SKILLS_DIR;

    // Load rules
    const ruleEngine = new RuleEngine(logger);
    const ruleLoader = new RuleLoader(ruleEngine);
    ruleLoader.loadBuiltins();
    await ruleLoader.loadFromDir(rulesDir);

    // Get abbreviated lists
    const rules = getAbbreviatedRules(ruleEngine);
    const skills = await getAbbreviatedSkills(skillsDir);

    if (rules.length === 0 && skills.length === 0) return;

    // Run augmentation
    const augmentor = new PromptAugmentor(augConfig, logger);
    const result = await augmentor.augment(prompt, rules, skills);

    // Output only the habitat context section (not the original prompt)
    if (result.matching.matchedRules.length === 0 && result.matching.matchedSkills.length === 0) {
      return;
    }

    const lines: string[] = [
      '',
      '---',
      '[Habitat Context]',
      `Keywords: ${result.extraction.keywords.join(', ')}`,
      `Summary: ${result.extraction.summary}`,
    ];

    // Build MANDATORY directives from matched rules/skills
    const mandatoryItems: string[] = [];
    for (const r of result.matching.matchedRules) {
      const matchedRule = rules.find(rule => rule.name === r.name);
      let directive: string | undefined;
      if (matchedRule?.content) {
        const sentences = matchedRule.content.split(/[.。\n]/);
        directive = sentences.find(s => /MUST|Call|必须|调用/.test(s))?.trim();
      }
      if (!directive) {
        directive = matchedRule?.description ?? r.reasoning;
      }
      mandatoryItems.push(`${directive} (rule: ${r.name})`);
    }
    for (const s of result.matching.matchedSkills) {
      mandatoryItems.push(`You MUST call habitat_skill_resolve("${s.name}") and strictly follow the loaded protocol. (skill: ${s.name})`);
    }

    if (mandatoryItems.length > 0) {
      lines.push('');
      lines.push('[MANDATORY — Violation of the following directives constitutes a session protocol breach]');
      const capped = mandatoryItems.slice(0, 5);
      capped.forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push('Non-compliance is a protocol violation.');
    }

    if (result.matching.matchedRules.length > 0) {
      lines.push('');
      lines.push('[Matched Rules]');
      for (const r of result.matching.matchedRules) {
        lines.push(`- ${r.name} (${r.confidence}): ${r.reasoning}`);
      }
    }

    if (result.matching.matchedSkills.length > 0) {
      lines.push('');
      lines.push('[Matched Skills]');
      for (const s of result.matching.matchedSkills) {
        lines.push(`- ${s.name} (${s.confidence}): ${s.reasoning}`);
      }
    }

    process.stdout.write(lines.join('\n'));
  } catch {
    // Silent failure — never block the prompt
  }
}

main().then(() => process.exit(0)).catch(() => process.exit(0));
