import type { RuleEngine } from '../rule/engine.js';
import type { AbbreviatedRule, AbbreviatedSkill } from './types.js';
import { readdirOrEmpty } from '../../infra/fs-utils.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

export function getAbbreviatedRules(ruleEngine: RuleEngine): AbbreviatedRule[] {
  return ruleEngine
    .getAll()
    .filter((r) => r.enabled)
    .map((r) => ({ name: r.name, description: r.description, content: r.content, keywords: r.keywords }));
}

export async function getAbbreviatedSkills(skillsDir: string): Promise<AbbreviatedSkill[]> {
  try {
    const files = await readdirOrEmpty(skillsDir);
    const skills: AbbreviatedSkill[] = [];

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const name = file.replace(/\.md$/, '');
      const content = await fs.readFile(join(skillsDir, file), 'utf-8');
      const description = extractDescription(content);
      skills.push({ name, description });
    }

    return skills;
  } catch {
    return [];
  }
}

function extractDescription(content: string): string {
  if (!content.startsWith('---')) return '';
  const endIdx = content.indexOf('---', 3);
  if (endIdx === -1) return '';

  const frontmatter = content.slice(3, endIdx);
  const descMatch = frontmatter.match(/^description:\s*"?(.+?)"?\s*$/m);
  return descMatch ? descMatch[1] : '';
}
