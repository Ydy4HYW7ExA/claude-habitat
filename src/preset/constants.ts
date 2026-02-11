/**
 * Shared constants for claude-habitat preset system.
 * Single source of truth for paths, markers, and mappings.
 */

import { join } from 'node:path';
import { homedir } from 'node:os';

// ── Directories ───────────────────────────────────────────────────────
export const HOME = homedir();
export const CLAUDE_DIR = join(HOME, '.claude');
export const HABITAT_DIR = join(HOME, '.claude-habitat');
export const COMMANDS_DIR = join(CLAUDE_DIR, 'commands');
export const SKILLS_DIR = join(CLAUDE_DIR, 'skills');
export const CLAUDE_MD_DEST = join(CLAUDE_DIR, 'CLAUDE.md');
export const SETTINGS_JSON = join(CLAUDE_DIR, 'settings.json');

// ── Habitat Source-of-Truth Directories ──────────────────────────────
export const HABITAT_COMMANDS_DIR = join(HABITAT_DIR, 'commands');
export const HABITAT_SKILLS_DIR = join(HABITAT_DIR, 'skills');
export const HABITAT_RULES_DIR = join(HABITAT_DIR, 'rules');

// ── Markers ───────────────────────────────────────────────────────────
/** @deprecated Use HABITAT_BEGIN_MARKER / HABITAT_END_MARKER instead. Will be removed after migration. */
export const CLAUDE_MD_MARKER = '<!-- claude-habitat-managed -->';
export const HABITAT_BEGIN_MARKER = '<!-- habitat-begin -->';
export const HABITAT_END_MARKER = '<!-- habitat-end -->';

// ── Naming ───────────────────────────────────────────────────────────
export const HABITAT_PREFIX = 'habitat-';
export const HABITAT_NAME_PATTERN = new RegExp(`^${HABITAT_PREFIX}[a-z][a-z0-9-]*$`);
export const SYMLINK_FILE_PATTERN = new RegExp(`^${HABITAT_PREFIX}.*\\.md$`);

// ── Skill names ──────────────────────────────────────────────────────
export const SKILL_PROJECT_ITERATE = 'habitat-project-iterate';
export const SKILL_MANAGE_COMMANDS = 'habitat-manage-commands';
export const SKILL_MANAGE_MCP = 'habitat-manage-mcp';
export const SKILL_MANAGE_RULES = 'habitat-manage-rules';
export const SKILL_MANAGE_SKILLS = 'habitat-manage-skills';

// ── Rule IDs ─────────────────────────────────────────────────────────
export const RULE_WORKFLOW_ID = 'rule-workflow';

// ── Rule → Skill mapping ─────────────────────────────────────────────
/**
 * @deprecated Replaced by SkillMatcher AI semantic matching.
 * Only used as fallback when SkillMatcher is unavailable (e.g. install.mjs without API key).
 */
export const RULE_SKILL_MAP: Record<string, string[]> = {
  [RULE_WORKFLOW_ID]: [SKILL_PROJECT_ITERATE],
};
