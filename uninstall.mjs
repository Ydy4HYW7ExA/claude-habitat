#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const CLAUDE_DIR = join(homedir(), '.claude');
const CLAUDE_JSON = join(homedir(), '.claude.json');

async function uninstall() {
  const projectDir = resolve(import.meta.dirname || '.');

  // Import compiled modules
  const { removeSymlinks } = await import(
    join(projectDir, 'dist', 'preset', 'symlinker.js')
  );
  const { removeMarkerSection } = await import(
    join(projectDir, 'dist', 'preset', 'installer.js')
  );
  const {
    HABITAT_COMMANDS_DIR, HABITAT_SKILLS_DIR,
    COMMANDS_DIR, SKILLS_DIR, CLAUDE_MD_DEST, SETTINGS_JSON,
  } = await import(join(projectDir, 'dist', 'preset', 'constants.js'));

  // [1/5] Remove MCP server registration from ~/.claude.json
  try {
    const raw = await fs.readFile(CLAUDE_JSON, 'utf-8');
    const claudeJson = JSON.parse(raw);
    if (claudeJson.mcpServers) {
      delete claudeJson.mcpServers['claude-habitat'];
      await fs.writeFile(CLAUDE_JSON, JSON.stringify(claudeJson, null, 2));
    }
    console.log('[1/5] MCP server unregistered from ~/.claude.json.');
  } catch {
    console.log('[1/5] No MCP config to clean up.');
  }

  // [2/5] Remove symlinks
  const skillRemoved = await removeSymlinks(HABITAT_SKILLS_DIR, SKILLS_DIR);
  const cmdRemoved = await removeSymlinks(HABITAT_COMMANDS_DIR, COMMANDS_DIR);
  console.log(`[2/5] Removed ${skillRemoved + cmdRemoved} symlinks.`);

  // [3/5] Remove CLAUDE.md marker section
  const removed = await removeMarkerSection(CLAUDE_MD_DEST);
  if (removed) {
    console.log('[3/5] Removed habitat section from CLAUDE.md.');
  } else {
    console.log('[3/5] No habitat section in CLAUDE.md.');
  }

  // [4/5] Remove UserPromptSubmit hook from ~/.claude/settings.json
  try {
    const raw = await fs.readFile(SETTINGS_JSON, 'utf-8');
    const settings = JSON.parse(raw);
    if (Array.isArray(settings.hooks?.UserPromptSubmit)) {
      const augmentSuffix = 'dist/cli/augment.js';
      settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
        (entry) => !entry.hooks?.some((h) => h.type === 'command' && h.command?.endsWith(augmentSuffix)),
      );
      if (settings.hooks.UserPromptSubmit.length === 0) {
        delete settings.hooks.UserPromptSubmit;
      }
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks;
      }
      await fs.writeFile(SETTINGS_JSON, JSON.stringify(settings, null, 2));
    }
    console.log('[4/5] UserPromptSubmit hook removed from settings.json.');
  } catch {
    console.log('[4/5] No settings.json hook to clean up.');
  }

  // [5/5] Inform user
  console.log('[5/5] ~/.claude-habitat/ data preserved. Delete manually if no longer needed.');

  console.log('\nclaude-habitat uninstalled.');
}

uninstall().catch(console.error);
