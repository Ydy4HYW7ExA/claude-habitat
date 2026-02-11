import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { isEnoent } from '../../infra/fs-utils.js';
import type {
  SkillProtocol,
  SkillStep,
  SkillMetadata,
  StepAnnotation,
  QualityGate,
  Pitfall,
} from './types.js';

const SKILL_NAME_RE = /^[a-z][a-z0-9-]*$/;

export class SkillParser {
  private cache = new Map<string, SkillProtocol>();

  constructor(private skillsDir: string) {}

  async resolve(
    skillName: string,
    resolveImports = true,
    _importChain?: Set<string>,
  ): Promise<SkillProtocol> {
    if (!SKILL_NAME_RE.test(skillName)) {
      throw new Error(`Invalid skill name: "${skillName}" (must be kebab-case: ${SKILL_NAME_RE})`);
    }

    const cacheKey = `${skillName}:${resolveImports}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const chain = _importChain ?? new Set<string>();
    if (chain.has(skillName)) {
      throw new Error(`Circular import detected: ${[...chain, skillName].join(' -> ')}`);
    }
    chain.add(skillName);

    const filePath = await this.findSkillFile(skillName);
    const raw = await fs.readFile(filePath, 'utf-8');
    const protocol = this.parse(raw, skillName);

    if (resolveImports && protocol.imports.length > 0) {
      protocol.rawContent = await this.resolveImportDirectives(
        protocol.rawContent,
        protocol.imports,
        chain,
      );
    }

    this.cache.set(cacheKey, protocol);
    return protocol;
  }

  async list(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });
      const skills: string[] = [];
      for (const e of entries) {
        if (e.isDirectory()) {
          skills.push(e.name);
        } else if (e.isFile() && e.name.endsWith('.md')) {
          skills.push(e.name.replace(/\.md$/, ''));
        }
      }
      return skills;
    } catch (e) {
      if (isEnoent(e)) return [];
      throw e;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async findSkillFile(skillName: string): Promise<string> {
    // Try directory-based layout first: skills/<name>/protocol.md
    const dirPath = join(this.skillsDir, skillName, 'protocol.md');
    try {
      await fs.access(dirPath);
      return dirPath;
    } catch (e) {
      if (!isEnoent(e)) throw e;
    }
    // Try flat layout: skills/<name>.md
    const flatPath = join(this.skillsDir, `${skillName}.md`);
    try {
      await fs.access(flatPath);
      return flatPath;
    } catch (e) {
      if (isEnoent(e)) {
        throw new Error(`Skill not found: "${skillName}" (searched ${dirPath} and ${flatPath})`);
      }
      throw e;
    }
  }

  private parse(content: string, name: string): SkillProtocol {
    const { metadata, body } = extractFrontMatter(content);
    const sections = extractSections(body);

    const description = extractDescription(body);
    const context = sections.get('context') ?? undefined;
    const steps = this.parseStepsSection(sections.get('steps') ?? '');
    const imports = parseImports(body);
    const qualityGates = parseQualityGates(sections.get('quality gates') ?? '');
    const pitfalls = parsePitfalls(sections.get('pitfalls') ?? '');
    const prerequisites = parseBulletList(sections.get('prerequisites') ?? '');
    const relatedSkills = parseBulletList(sections.get('related skills') ?? '');
    const notes = parseBulletList(sections.get('notes') ?? '');
    const successCriteria = parseBulletList(sections.get('success criteria') ?? '');

    // Merge inline tags into metadata
    const inlineTags = parseInlineTags(body);
    if (inlineTags.length > 0 && metadata && !metadata.tags?.length) {
      metadata.tags = inlineTags;
    }

    return {
      name,
      description,
      steps,
      imports,
      rawContent: content,
      metadata: metadata ?? undefined,
      context,
      prerequisites,
      qualityGates,
      pitfalls,
      relatedSkills,
      notes,
      successCriteria,
    };
  }

  private parseStepsSection(content: string): SkillStep[] {
    if (!content.trim()) return [];

    // Try Format C first: ### N. Step Name
    const formatC = content.match(/^###\s+\d+\./m);
    if (formatC) return parseStepsFormatC(content);

    // Try Format B: N. **Step Name**: Description
    const formatB = content.match(/^\d+\.\s+\*\*/m);
    if (formatB) return parseStepsFormatB(content);

    // Default: Format A: N. Step description [annotation]
    return parseStepsFormatA(content);
  }

  private async resolveImportDirectives(
    content: string,
    imports: string[],
    chain: Set<string>,
  ): Promise<string> {
    let resolved = content;
    for (const imp of imports) {
      try {
        const imported = await this.resolve(imp, true, chain);
        resolved = resolved.replace(`@import ${imp}`, imported.rawContent);
        resolved = resolved.replace(`@import "${imp}"`, imported.rawContent);
        resolved = resolved.replace(`@import '${imp}'`, imported.rawContent);
      } catch (err) {
        if (err instanceof Error && /[Cc]ircular/.test(err.message)) {
          throw err;
        }
        // Import not found, leave as-is
      }
    }
    return resolved;
  }
}

// --- Free helper functions ---

function extractFrontMatter(
  content: string,
): { metadata: SkillMetadata | null; body: string } {
  if (!content.startsWith('---')) {
    return { metadata: null, body: content };
  }
  const endIdx = content.indexOf('---', 3);
  if (endIdx === -1) {
    return { metadata: null, body: content };
  }
  const yamlBlock = content.slice(3, endIdx).trim();
  const body = content.slice(endIdx + 3).trim();
  const metadata = parseSimpleYaml(yamlBlock);
  return { metadata, body };
}

function parseSimpleYaml(yaml: string): SkillMetadata {
  const meta: Record<string, unknown> = {};
  let currentKey = '';

  for (const line of yaml.split('\n')) {
    // Array continuation: "  - value"
    const arrItem = line.match(/^\s+-\s+(.+)$/);
    if (arrItem && currentKey) {
      const arr = meta[currentKey];
      if (Array.isArray(arr)) {
        arr.push(arrItem[1].trim());
      }
      continue;
    }

    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    let value = kvMatch[2].trim();
    currentKey = key;

    // Inline array: [a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      meta[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim());
      continue;
    }

    // Empty value means upcoming indented list
    if (!value) {
      meta[key] = [];
      continue;
    }

    // Number
    if (/^\d+$/.test(value)) {
      meta[key] = parseInt(value, 10);
      continue;
    }

    meta[key] = value;
  }

  return meta as unknown as SkillMetadata;
}

function extractSections(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = body.split('\n');
  let currentName = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      if (currentName) {
        sections.set(currentName, currentLines.join('\n').trim());
      }
      currentName = heading[1].trim().toLowerCase();
      currentLines = [];
    } else if (currentName) {
      currentLines.push(line);
    }
  }
  if (currentName) {
    sections.set(currentName, currentLines.join('\n').trim());
  }
  return sections;
}

function extractDescription(body: string): string {
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('Tags:')) continue;
    if (trimmed.startsWith('@import')) continue;
    return trimmed;
  }
  return '';
}

function parseAnnotations(text: string): StepAnnotation[] {
  const annotations: StepAnnotation[] = [];
  const indepMatch = text.match(/\[independent\]/i);
  if (indepMatch) {
    annotations.push({ type: 'independent' });
  }
  const depMatch = text.match(/\[depends\s+on:\s*([^\]]+)\]/i);
  if (depMatch) {
    const steps = depMatch[1]
      .split(',')
      .map((s) => parseInt(s.replace(/[^0-9]/g, ''), 10))
      .filter((n) => !isNaN(n));
    annotations.push({ type: 'depends-on', steps });
  }
  const userMatch = text.match(/\[user-decision\]/i);
  if (userMatch) {
    annotations.push({ type: 'user-decision' });
  }
  return annotations;
}

function stripAnnotations(text: string): string {
  return text
    .replace(/\[independent\]/gi, '')
    .replace(/\[depends\s+on:\s*[^\]]+\]/gi, '')
    .replace(/\[user-decision\]/gi, '')
    .trim();
}

// Format A: "1. Step description [annotation]"
function parseStepsFormatA(content: string): SkillStep[] {
  const steps: SkillStep[] = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^(\d+)\.\s+(.+)$/);
    if (!m) continue;
    const num = parseInt(m[1], 10);
    const raw = m[2];
    const annotations = parseAnnotations(raw);
    const desc = stripAnnotations(raw);
    steps.push({
      number: num,
      name: desc,
      description: desc,
      annotations,
    });
  }
  return steps;
}

// Format B: "1. **Step Name**: Description" with indented sub-items
function parseStepsFormatB(content: string): SkillStep[] {
  const steps: SkillStep[] = [];
  let current: SkillStep | null = null;

  for (const line of content.split('\n')) {
    const stepMatch = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*[:\s]*(.*)$/);
    if (stepMatch) {
      if (current) steps.push(current);
      const num = parseInt(stepMatch[1], 10);
      const name = stepMatch[2].trim();
      const rest = stepMatch[3].trim();
      const annotations = parseAnnotations(rest);
      current = {
        number: num,
        name,
        description: stripAnnotations(rest),
        annotations,
      };
      continue;
    }

    if (!current) continue;

    const trimmed = line.trim();
    if (!trimmed) continue;

    // Sub-items under a step
    const subItem = trimmed.match(/^-\s+(.+)$/);
    if (subItem) {
      const subText = subItem[1];
      // Check for special sub-items
      const valMatch = subText.match(/^Validation:\s*(.+)/i);
      if (valMatch) {
        current.validation = valMatch[1].trim();
        continue;
      }
      const outcomeMatch = subText.match(/^Expected\s+outcome:\s*(.+)/i);
      if (outcomeMatch) {
        current.expectedOutcome = outcomeMatch[1].trim();
        continue;
      }
      // Annotation-only sub-items
      const annots = parseAnnotations(subText);
      if (annots.length > 0) {
        current.annotations.push(...annots);
        const stripped = stripAnnotations(subText);
        if (stripped && stripped !== '-') {
          current.description += (current.description ? '\n' : '') + stripped;
        }
        continue;
      }
      current.description += (current.description ? '\n' : '') + subText;
    }
  }
  if (current) steps.push(current);
  return steps;
}

// Format C: "### N. Step Name" with body paragraphs
function parseStepsFormatC(content: string): SkillStep[] {
  const steps: SkillStep[] = [];
  let current: SkillStep | null = null;

  for (const line of content.split('\n')) {
    const heading = line.match(/^###\s+(\d+)\.\s+(.+)$/);
    if (heading) {
      if (current) steps.push(current);
      const num = parseInt(heading[1], 10);
      const raw = heading[2].trim();
      const annotations = parseAnnotations(raw);
      current = {
        number: num,
        name: stripAnnotations(raw),
        description: '',
        annotations,
      };
      continue;
    }

    if (!current) continue;
    const trimmed = line.trim();
    if (!trimmed) continue;

    const annots = parseAnnotations(trimmed);
    if (annots.length > 0) {
      current.annotations.push(...annots);
    }
    const stripped = stripAnnotations(trimmed);
    if (stripped) {
      current.description += (current.description ? '\n' : '') + stripped;
    }
  }
  if (current) steps.push(current);
  return steps;
}

function parseQualityGates(content: string): QualityGate[] {
  const gates: QualityGate[] = [];
  for (const line of content.split('\n')) {
    // Checkbox format: "- [ ] **Mandatory**: text" or "- [ ] **Advisory**: text"
    const cbMatch = line.match(
      /^-\s+\[[ x]\]\s+\*\*(Mandatory|Advisory)\*\*[:\s]*(.+)$/i,
    );
    if (cbMatch) {
      gates.push({
        level: cbMatch[1].toLowerCase() as 'mandatory' | 'advisory',
        text: cbMatch[2].trim(),
      });
      continue;
    }
    // Plain list format: "- text"
    const plainMatch = line.match(/^-\s+(.+)$/);
    if (plainMatch) {
      gates.push({ level: 'mandatory', text: plainMatch[1].trim() });
    }
  }
  return gates;
}

function parsePitfalls(content: string): Pitfall[] {
  const pitfalls: Pitfall[] = [];

  // Check for structured format: ### Pitfall N: Name
  if (/^###\s+Pitfall\s+\d+/m.test(content)) {
    return parseStructuredPitfalls(content);
  }

  // Plain list format
  for (const line of content.split('\n')) {
    const m = line.match(/^-\s+(.+)$/);
    if (m) {
      pitfalls.push({ name: m[1].trim() });
    }
  }
  return pitfalls;
}

function parseStructuredPitfalls(content: string): Pitfall[] {
  const pitfalls: Pitfall[] = [];
  let current: Pitfall | null = null;

  for (const line of content.split('\n')) {
    const heading = line.match(/^###\s+Pitfall\s+\d+[:\s]*(.+)$/i);
    if (heading) {
      if (current) pitfalls.push(current);
      current = { name: heading[1].trim() };
      continue;
    }
    if (!current) continue;

    const fieldMatch = line.match(/^\*\*(\w+)\*\*[:\s]*(.+)$/);
    if (fieldMatch) {
      const key = fieldMatch[1].toLowerCase();
      const val = fieldMatch[2].trim();
      if (key === 'problem') current.problem = val;
      else if (key === 'impact') current.impact = val;
      else if (key === 'avoidance') current.avoidance = val;
      else if (key === 'example') current.example = val;
    }
  }
  if (current) pitfalls.push(current);
  return pitfalls;
}

function parseBulletList(content: string): string[] {
  const items: string[] = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^-\s+(.+)$/);
    if (m) {
      items.push(m[1].trim());
    }
  }
  return items;
}

function parseImports(body: string): string[] {
  const imports: string[] = [];
  for (const line of body.split('\n')) {
    // Inside code blocks, skip
    if (line.trim().startsWith('```')) continue;
    // @import "skill-name" or @import 'skill-name'
    const quoted = line.match(/^@import\s+["']([^"']+)["']/);
    if (quoted) {
      imports.push(quoted[1]);
      continue;
    }
    // @import skill-name (bare, must be kebab-case)
    const bare = line.match(/^@import\s+([a-z][a-z0-9-]*)\s*$/);
    if (bare) {
      imports.push(bare[1]);
    }
  }
  return imports;
}

function parseInlineTags(body: string): string[] {
  for (const line of body.split('\n')) {
    const m = line.match(/^Tags:\s*(.+)$/i);
    if (m) {
      return m[1].split(',').map((t) => t.trim()).filter(Boolean);
    }
  }
  return [];
}
