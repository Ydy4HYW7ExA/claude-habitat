/**
 * CRUD service for habitat files (commands, skills, rules).
 * Source of truth lives in .claude-habitat/, consumed via symlinks in .claude/.
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { Logger } from '../../logging/logger.js';
import type {
  HabitatScope, HabitatFileKind, HabitatFileInfo,
  HabitatFileCreateInput, HabitatFileUpdateInput,
} from './types.js';
import { NotFoundError, ValidationError, DuplicateError } from '../../infra/errors.js';
import { readdirOrEmpty, readFileOrNull } from '../../infra/fs-utils.js';
import { ensureSymlink, removeSymlink } from '../../preset/symlinker.js';
import { injectMarkerSection } from '../../preset/installer.js';
import { generateClaudeMd } from '../../preset/claude-md-generator.js';
import { HABITAT_NAME_PATTERN, HABITAT_PREFIX } from '../../preset/constants.js';
import type { SkillMatcher } from '../skill-matcher/matcher.js';
import type { RuleEngine } from '../rule/engine.js';

const EXT_MAP: Record<HabitatFileKind, string> = {
  command: '.md',
  skill: '.md',
  rule: '.json',
};

const DIR_SUFFIX: Record<HabitatFileKind, string> = {
  command: 'commands',
  skill: 'skills',
  rule: 'rules',
};

export class HabitatFileService {
  constructor(
    private globalHabitatDir: string,
    private globalClaudeDir: string,
    private logger: Logger,
    private skillMatcher?: SkillMatcher,
    private ruleEngine?: RuleEngine,
  ) {}

  private resolveDirs(scope: HabitatScope, kind: HabitatFileKind): {
    habitatDir: string;
    claudeDir: string;
    claudeMdPath: string;
  } {
    const suffix = DIR_SUFFIX[kind];
    if (scope === 'global') {
      return {
        habitatDir: join(this.globalHabitatDir, suffix),
        claudeDir: join(this.globalClaudeDir, suffix),
        claudeMdPath: join(this.globalClaudeDir, 'CLAUDE.md'),
      };
    }
    const cwd = process.cwd();
    return {
      habitatDir: join(cwd, '.claude-habitat', suffix),
      claudeDir: join(cwd, '.claude', suffix),
      claudeMdPath: join(cwd, 'CLAUDE.md'),
    };
  }

  private validateName(name: string): void {
    if (!HABITAT_NAME_PATTERN.test(name)) {
      throw new ValidationError(
        `Invalid name: "${name}". Must start with "${HABITAT_PREFIX}" and be kebab-case.`,
        [`Name must start with "${HABITAT_PREFIX}" and be kebab-case`],
      );
    }
  }

  private fileName(name: string, kind: HabitatFileKind): string {
    return name + EXT_MAP[kind];
  }

  private async refreshClaudeMd(scope: HabitatScope): Promise<void> {
    const { claudeMdPath } = this.resolveDirs(scope, 'rule');
    const baseDir = scope === 'global' ? this.globalHabitatDir : join(process.cwd(), '.claude-habitat');
    const content = await generateClaudeMd(baseDir, this.skillMatcher);
    await injectMarkerSection(claudeMdPath, content);
    this.logger.info(`Refreshed CLAUDE.md for scope=${scope}`);
  }

  async create(input: HabitatFileCreateInput): Promise<HabitatFileInfo> {
    this.validateName(input.name);
    const { habitatDir, claudeDir, claudeMdPath } = this.resolveDirs(input.scope, input.kind);
    const file = this.fileName(input.name, input.kind);
    const filePath = join(habitatDir, file);

    // Check for duplicates
    const existing = await readFileOrNull(filePath);
    if (existing !== null) {
      throw new DuplicateError(input.kind, input.name);
    }

    await fs.mkdir(habitatDir, { recursive: true });
    await fs.writeFile(filePath, input.content);
    this.logger.info(`Created ${input.kind} "${input.name}" in ${input.scope}`);

    let symlinkPath: string | undefined;
    if (input.kind !== 'rule') {
      symlinkPath = join(claudeDir, file);
      await ensureSymlink(filePath, symlinkPath);
      // Skill changes affect AI matching results → refresh CLAUDE.md
      if (input.kind === 'skill') {
        this.skillMatcher?.invalidateCache();
        await this.refreshClaudeMd(input.scope);
      }
    } else {
      // Register rule in RuleEngine for runtime evaluation
      if (this.ruleEngine) {
        try {
          const ruleData = JSON.parse(input.content);
          this.ruleEngine.register(ruleData);
        } catch { /* non-JSON rule content is fine */ }
      }
      this.skillMatcher?.invalidateCache(input.name);
      await this.refreshClaudeMd(input.scope);
    }

    return { name: input.name, kind: input.kind, scope: input.scope, filePath, symlinkPath, content: input.content };
  }

  async read(name: string, kind: HabitatFileKind, scope: HabitatScope): Promise<HabitatFileInfo> {
    this.validateName(name);
    const { habitatDir, claudeDir } = this.resolveDirs(scope, kind);
    const file = this.fileName(name, kind);
    const filePath = join(habitatDir, file);

    const content = await readFileOrNull(filePath);
    if (content === null) {
      throw new NotFoundError(kind, name);
    }

    const symlinkPath = kind !== 'rule' ? join(claudeDir, file) : undefined;
    return { name, kind, scope, filePath, symlinkPath, content };
  }

  async update(input: HabitatFileUpdateInput): Promise<HabitatFileInfo> {
    this.validateName(input.name);
    const { habitatDir, claudeDir } = this.resolveDirs(input.scope, input.kind);
    const file = this.fileName(input.name, input.kind);
    const filePath = join(habitatDir, file);

    const existing = await readFileOrNull(filePath);
    if (existing === null) {
      throw new NotFoundError(input.kind, input.name);
    }

    await fs.writeFile(filePath, input.content);
    this.logger.info(`Updated ${input.kind} "${input.name}" in ${input.scope}`);

    if (input.kind === 'rule') {
      if (this.ruleEngine) {
        try {
          const ruleData = JSON.parse(input.content);
          this.ruleEngine.register(ruleData);
        } catch { /* non-JSON rule content is fine */ }
      }
      this.skillMatcher?.invalidateCache(input.name);
      await this.refreshClaudeMd(input.scope);
    } else if (input.kind === 'skill') {
      this.skillMatcher?.invalidateCache();
      await this.refreshClaudeMd(input.scope);
    }

    const symlinkPath = input.kind !== 'rule' ? join(claudeDir, file) : undefined;
    return { name: input.name, kind: input.kind, scope: input.scope, filePath, symlinkPath, content: input.content };
  }

  async delete(name: string, kind: HabitatFileKind, scope: HabitatScope): Promise<void> {
    this.validateName(name);
    const { habitatDir, claudeDir } = this.resolveDirs(scope, kind);
    const file = this.fileName(name, kind);
    const filePath = join(habitatDir, file);

    const existing = await readFileOrNull(filePath);
    if (existing === null) {
      throw new NotFoundError(kind, name);
    }

    await fs.unlink(filePath);
    this.logger.info(`Deleted ${kind} "${name}" from ${scope}`);

    if (kind !== 'rule') {
      await removeSymlink(join(claudeDir, file));
      if (kind === 'skill') {
        this.skillMatcher?.invalidateCache();
        await this.refreshClaudeMd(scope);
      }
    } else {
      if (this.ruleEngine) {
        this.ruleEngine.unregister(name);
      }
      this.skillMatcher?.invalidateCache(name);
      await this.refreshClaudeMd(scope);
    }
  }

  async list(kind: HabitatFileKind, scope: HabitatScope): Promise<HabitatFileInfo[]> {
    const { habitatDir, claudeDir } = this.resolveDirs(scope, kind);
    const ext = EXT_MAP[kind];
    const entries = await readdirOrEmpty(habitatDir);
    const files = entries.filter((f) => f.endsWith(ext));

    const results: HabitatFileInfo[] = [];
    for (const file of files) {
      const filePath = join(habitatDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const name = file.slice(0, -ext.length);
      const symlinkPath = kind !== 'rule' ? join(claudeDir, file) : undefined;
      results.push({ name, kind, scope, filePath, symlinkPath, content });
    }

    return results;
  }
}
