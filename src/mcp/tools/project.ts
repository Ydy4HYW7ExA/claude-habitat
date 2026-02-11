import { promises as fs } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import type { Container } from '../../di/container.js';
import { defineTool, type ToolMetadata } from '../define-tool.js';
import {
  HABITAT_DIR, HABITAT_SKILLS_DIR, HABITAT_COMMANDS_DIR, HABITAT_RULES_DIR,
} from '../../preset/constants.js';
import { readdirOrEmpty, isEnoent, readFileOrNull } from '../../infra/fs-utils.js';
import { installFiles } from '../../preset/installer.js';
import { injectMarkerSection } from '../../preset/installer.js';
import { syncSymlinks } from '../../preset/symlinker.js';
import { generateClaudeMd } from '../../preset/claude-md-generator.js';

/**
 * Ensure `.claude-habitat/` is listed in the project's .gitignore.
 */
async function ensureGitignore(projectPath: string): Promise<boolean> {
  const gitignorePath = join(projectPath, '.gitignore');
  const entry = '.claude-habitat/';

  let content = await readFileOrNull(gitignorePath);
  if (content !== null) {
    // Check if already present (exact line match)
    const lines = content.split('\n');
    if (lines.some((l) => l.trim() === entry)) return false;
    // Ensure trailing newline before appending
    if (content.length > 0 && !content.endsWith('\n')) content += '\n';
    content += entry + '\n';
  } else {
    content = entry + '\n';
  }

  await fs.writeFile(gitignorePath, content, 'utf-8');
  return true;
}

/**
 * Detect existing config sources for prompt augmentation.
 */
async function detectConfigSources(): Promise<Record<string, unknown>> {
  const sources: Record<string, unknown> = {
    globalConfigExists: false,
    globalHasApiKey: false,
    envHasAuthToken: false,
  };

  // Check global config
  const globalConfigPath = join(HABITAT_DIR, 'config.json');
  const globalRaw = await readFileOrNull(globalConfigPath);
  if (globalRaw !== null) {
    sources.globalConfigExists = true;
    try {
      const cfg = JSON.parse(globalRaw);
      if (cfg?.promptAugmentor?.apiKey || cfg?.skillMatcher?.apiKey) {
        sources.globalHasApiKey = true;
      }
    } catch { /* invalid JSON */ }
  }

  // Check Claude settings for env vars
  const settingsPath = join(homedir(), '.claude', 'settings.json');
  const settingsRaw = await readFileOrNull(settingsPath);
  if (settingsRaw !== null) {
    try {
      const settings = JSON.parse(settingsRaw);
      if (settings?.env?.ANTHROPIC_AUTH_TOKEN) {
        sources.envHasAuthToken = true;
      }
    } catch { /* invalid JSON */ }
  }

  return sources;
}

export function registerProjectTools(container: Container): ToolMetadata[] {
  return [
    defineTool({
      name: 'habitat_project_init',
      description: 'Initialize a project with claude-habitat environment.',
      schema: {
        type: 'object',
        properties: {
          projectPath: { type: 'string', description: 'Absolute path to the project directory' },
          projectName: { type: 'string', description: 'Optional project name' },
        },
        required: ['projectPath'],
      },
      async handler(input: { projectPath: string; projectName?: string }) {
        const habitatDir = join(input.projectPath, '.claude-habitat');
        await fs.mkdir(habitatDir, { recursive: true });

        const projectId = randomBytes(8).toString('hex');
        const marker = {
          projectId,
          projectName: input.projectName ?? basename(input.projectPath),
          version: '1.0.0',
          createdAt: new Date().toISOString(),
        };

        await fs.writeFile(
          join(habitatDir, 'marker.json'),
          JSON.stringify(marker, null, 2),
        );

        // Create .claude-habitat subdirectories
        const projHabitatSkills = join(habitatDir, 'skills');
        const projHabitatCommands = join(habitatDir, 'commands');
        const projHabitatRules = join(habitatDir, 'rules');
        await fs.mkdir(join(habitatDir, 'documents'), { recursive: true });
        await fs.mkdir(join(habitatDir, 'workflows'), { recursive: true });
        await fs.mkdir(projHabitatSkills, { recursive: true });
        await fs.mkdir(projHabitatCommands, { recursive: true });
        await fs.mkdir(projHabitatRules, { recursive: true });

        // Copy preset files from global habitat to project habitat
        await installFiles(HABITAT_SKILLS_DIR, projHabitatSkills, '.md');
        await installFiles(HABITAT_COMMANDS_DIR, projHabitatCommands, '.md');
        await installFiles(HABITAT_RULES_DIR, projHabitatRules, '.json');

        // Create .claude/ and symlink from project habitat
        const claudeDir = join(input.projectPath, '.claude');
        const projClaudeSkills = join(claudeDir, 'skills');
        const projClaudeCommands = join(claudeDir, 'commands');
        await fs.mkdir(projClaudeSkills, { recursive: true });
        await fs.mkdir(projClaudeCommands, { recursive: true });

        await syncSymlinks(projHabitatSkills, projClaudeSkills, /^habitat-.*\.md$|^project-.*\.md$/);
        await syncSymlinks(projHabitatCommands, projClaudeCommands, /^habitat-.*\.md$/);

        // Generate project-level CLAUDE.md with marker injection
        const claudeMdDest = join(input.projectPath, 'CLAUDE.md');
        const content = await generateClaudeMd(habitatDir);
        await injectMarkerSection(claudeMdDest, content);

        // Ensure .claude-habitat/ is in .gitignore
        await ensureGitignore(input.projectPath);

        // Detect config sources for prompt augmentation setup
        const configSources = await detectConfigSources();

        return {
          projectId, projectName: marker.projectName,
          habitatDir, claudeDir, configSources,
        };
      },
    }),

    defineTool({
      name: 'habitat_project_info',
      description: 'Retrieve comprehensive information about a claude-habitat project.',
      schema: {
        type: 'object',
        properties: {
          projectPath: { type: 'string', description: 'Absolute path to the project directory' },
        },
        required: [],
      },
      async handler(input: { projectPath?: string }) {
        const projectPath = input.projectPath ?? process.cwd();
        const habitatDir = join(projectPath, '.claude-habitat');

        try {
          const raw = await fs.readFile(join(habitatDir, 'marker.json'), 'utf-8');
          const markerData = JSON.parse(raw);

          const docs = await readdirOrEmpty(join(habitatDir, 'documents'));
          const docCount = docs.filter((f) => f.endsWith('.json')).length;
          const wfs = await readdirOrEmpty(join(habitatDir, 'workflows'));
          const wfCount = wfs.filter((f) => f.endsWith('.json')).length;

          return {
            ...markerData,
            paths: { root: projectPath, habitat: habitatDir },
            stats: { documents: docCount, workflows: wfCount },
            status: 'initialized',
          };
        } catch (e) {
          if (isEnoent(e)) {
            return { status: 'unknown', message: 'No habitat found at path' };
          }
          throw e;
        }
      },
    }),

    defineTool({
      name: 'habitat_project_configure',
      description: 'Configure prompt augmentation for a claude-habitat project.',
      schema: {
        type: 'object',
        properties: {
          projectPath: { type: 'string', description: 'Absolute path to the project directory' },
          apiKey: { type: 'string', description: 'API key for prompt augmentation' },
          endpoint: { type: 'string', description: 'API endpoint URL' },
          model: { type: 'string', description: 'Model name for augmentation' },
          enabled: { type: 'boolean', description: 'Enable prompt augmentation' },
          useGlobalConfig: { type: 'boolean', description: 'Skip project config, rely on global' },
        },
        required: ['projectPath'],
      },
      async handler(input: {
        projectPath: string;
        apiKey?: string;
        endpoint?: string;
        model?: string;
        enabled?: boolean;
        useGlobalConfig?: boolean;
      }) {
        if (input.useGlobalConfig) {
          return { configured: true, source: 'global', message: 'Using global config' };
        }

        const habitatDir = join(input.projectPath, '.claude-habitat');
        await fs.mkdir(habitatDir, { recursive: true });

        // Build minimal config — only include provided fields
        const augConfig: Record<string, unknown> = {};
        if (input.apiKey !== undefined) augConfig.apiKey = input.apiKey;
        if (input.endpoint !== undefined) augConfig.endpoint = input.endpoint;
        if (input.model !== undefined) augConfig.model = input.model;

        // If no apiKey and enabled not explicitly set, disable
        if (input.apiKey === undefined && input.enabled === undefined) {
          augConfig.enabled = false;
        } else if (input.enabled !== undefined) {
          augConfig.enabled = input.enabled;
        }

        const config = {
          promptAugmentor: { ...augConfig },
          skillMatcher: { ...augConfig },
        };

        const configPath = join(habitatDir, 'config.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

        return {
          configured: true,
          source: 'project',
          configPath,
          enabled: augConfig.enabled !== false,
        };
      },
    }),
  ];
}
