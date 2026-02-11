#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';

const CLAUDE_DIR = join(homedir(), '.claude');
const CLAUDE_JSON = join(homedir(), '.claude.json');

let _rl = null;
function ask(question) {
  if (!_rl) {
    _rl = createInterface({ input: process.stdin, output: process.stdout });
  }
  return new Promise((resolve) => {
    _rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}
function closeRl() {
  if (_rl) { _rl.close(); _rl = null; }
}


async function install() {
  // Check Node.js version
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < 20) {
    console.error(`Node.js >= 20 required (current: ${process.versions.node})`);
    process.exit(1);
  }

  const projectDir = resolve(import.meta.dirname || '.');
  const serverPath = join(projectDir, 'dist', 'mcp', 'main.js');
  const presetsDir = join(projectDir, 'dist', 'presets');

  await fs.mkdir(CLAUDE_DIR, { recursive: true });

  // Import compiled modules
  const { installFiles, injectMarkerSection } = await import(
    join(projectDir, 'dist', 'preset', 'installer.js')
  );
  const { syncSymlinks } = await import(
    join(projectDir, 'dist', 'preset', 'symlinker.js')
  );
  const { generateClaudeMd } = await import(
    join(projectDir, 'dist', 'preset', 'claude-md-generator.js')
  );
  const {
    HABITAT_COMMANDS_DIR, HABITAT_SKILLS_DIR, HABITAT_RULES_DIR,
    COMMANDS_DIR, SKILLS_DIR, CLAUDE_MD_DEST, SETTINGS_JSON,
    SYMLINK_FILE_PATTERN,
  } = await import(join(projectDir, 'dist', 'preset', 'constants.js'));

  // [1/8] Register MCP server in ~/.claude.json
  let claudeJson = {};
  try {
    const raw = await fs.readFile(CLAUDE_JSON, 'utf-8');
    claudeJson = JSON.parse(raw);
  } catch { /* first install */ }

  if (!claudeJson.mcpServers) claudeJson.mcpServers = {};
  claudeJson.mcpServers['claude-habitat'] = {
    command: 'node',
    args: [serverPath],
    env: {},
  };

  await fs.writeFile(CLAUDE_JSON, JSON.stringify(claudeJson, null, 2));
  console.log('[1/8] MCP server registered in ~/.claude.json.');

  // [2/8] Install skills to habitat
  const skillCount = await installFiles(
    join(presetsDir, 'skills'), HABITAT_SKILLS_DIR, '.md',
  );
  console.log(`[2/8] Skills: ${skillCount} files installed to ${HABITAT_SKILLS_DIR}`);

  // [3/8] Install commands to habitat
  const cmdCount = await installFiles(
    join(presetsDir, 'commands'), HABITAT_COMMANDS_DIR, '.md',
  );
  console.log(`[3/8] Commands: ${cmdCount} files installed to ${HABITAT_COMMANDS_DIR}`);

  // [4/8] Install rules to habitat
  const ruleCount = await installFiles(
    join(presetsDir, 'rules'), HABITAT_RULES_DIR, '.json',
  );
  console.log(`[4/8] Rules: ${ruleCount} files installed to ${HABITAT_RULES_DIR}`);

  // [5/8] Create symlinks
  const skillSync = await syncSymlinks(
    HABITAT_SKILLS_DIR, SKILLS_DIR, SYMLINK_FILE_PATTERN,
  );
  const cmdSync = await syncSymlinks(
    HABITAT_COMMANDS_DIR, COMMANDS_DIR, /^habitat-.*\.md$/,
  );
  console.log(
    `[5/8] Symlinks: skills(+${skillSync.created} =${skillSync.skipped} -${skillSync.removed}) ` +
    `commands(+${cmdSync.created} =${cmdSync.skipped} -${cmdSync.removed})`,
  );

  // [6/8] Inject CLAUDE.md marker section
  // generateClaudeMd is now async; try to use SkillMatcher if config has API key
  let skillMatcher = null;
  try {
    const HABITAT_DIR = join(homedir(), '.claude-habitat');
    const configPath = join(HABITAT_DIR, 'config.json');
    const configRaw = await fs.readFile(configPath, 'utf-8').catch(() => '{}');
    const habitatConfig = JSON.parse(configRaw);
    if (habitatConfig?.skillMatcher?.apiKey) {
      const { SkillMatcher } = await import(
        join(projectDir, 'dist', 'domain', 'skill-matcher', 'matcher.js')
      );
      const noopLogger = { debug() {}, info() {}, warn() {}, error() {}, child() { return this; } };
      skillMatcher = new SkillMatcher(habitatConfig.skillMatcher, noopLogger);
    }
  } catch { /* SkillMatcher unavailable — will use RULE_SKILL_MAP fallback */ }

  const claudeMd = await generateClaudeMd(presetsDir, skillMatcher);
  const injected = await injectMarkerSection(CLAUDE_MD_DEST, claudeMd);
  if (injected) {
    console.log(`[6/8] CLAUDE.md marker section injected at ${CLAUDE_MD_DEST}`);
  } else {
    console.log('[6/8] CLAUDE.md unchanged (skipped).');
  }

  // [7/8] Register UserPromptSubmit hook in ~/.claude/settings.json
  const augmentScript = join(projectDir, 'dist', 'cli', 'augment.js');
  let settings = {};
  try {
    const raw = await fs.readFile(SETTINGS_JSON, 'utf-8');
    settings = JSON.parse(raw);
  } catch { /* first install or missing file */ }

  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks.UserPromptSubmit)) {
    settings.hooks.UserPromptSubmit = [];
  }

  const hookCommand = `node ${augmentScript}`;
  const alreadyRegistered = settings.hooks.UserPromptSubmit.some(
    (entry) => entry.hooks?.some((h) => h.type === 'command' && h.command === hookCommand),
  );

  if (!alreadyRegistered) {
    settings.hooks.UserPromptSubmit.push({
      matcher: '',
      hooks: [{ type: 'command', command: hookCommand }],
    });
  }

  await fs.writeFile(SETTINGS_JSON, JSON.stringify(settings, null, 2));
  console.log(`[7/8] UserPromptSubmit hook registered in ${SETTINGS_JSON}`);

  // [8/8] Interactive prompt augmentation config
  const HABITAT_DIR_CONF = join(homedir(), '.claude-habitat');
  const configPath = join(HABITAT_DIR_CONF, 'config.json');

  // Check if config already exists with an apiKey
  let existingConfig = null;
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    existingConfig = JSON.parse(raw);
  } catch { /* no existing config */ }

  if (existingConfig?.promptAugmentor?.apiKey) {
    console.log('[8/8] Config already exists with API key — skipping.');
  } else {
    // Detect API key from Claude settings
    let detectedApiKey = null;
    let detectedEndpoint = null;

    // Check ~/.claude/settings.json env
    try {
      const raw = await fs.readFile(SETTINGS_JSON, 'utf-8');
      const s = JSON.parse(raw);
      if (s?.env?.ANTHROPIC_AUTH_TOKEN) detectedApiKey = s.env.ANTHROPIC_AUTH_TOKEN;
      if (s?.env?.ANTHROPIC_BASE_URL) detectedEndpoint = s.env.ANTHROPIC_BASE_URL;
    } catch { /* no settings */ }

    // Also check ~/.claude.json mcpServers env
    if (!detectedApiKey) {
      try {
        const raw = await fs.readFile(CLAUDE_JSON, 'utf-8');
        const cj = JSON.parse(raw);
        for (const server of Object.values(cj.mcpServers || {})) {
          if (server?.env?.ANTHROPIC_AUTH_TOKEN) {
            detectedApiKey = server.env.ANTHROPIC_AUTH_TOKEN;
            break;
          }
        }
      } catch { /* no claude.json */ }
    }

    console.log('\n--- Prompt Augmentation Setup ---');

    let apiKey = null;
    if (detectedApiKey) {
      const masked = detectedApiKey.slice(0, 8) + '...' + detectedApiKey.slice(-4);
      const useDetected = await ask(`Detected API key: ${masked}. Use it? [Y/n] `);
      if (useDetected === '' || useDetected.toLowerCase() === 'y') {
        apiKey = detectedApiKey;
      }
    }

    if (!apiKey) {
      apiKey = await ask('Enter Anthropic API key (leave empty to disable augmentation): ');
      if (!apiKey) apiKey = null;
    }

    let endpoint = 'https://api.anthropic.com';
    if (detectedEndpoint) {
      const useEp = await ask(`Detected endpoint: ${detectedEndpoint}. Use it? [Y/n] `);
      if (useEp === '' || useEp.toLowerCase() === 'y') {
        endpoint = detectedEndpoint;
      }
    }

    const modelDefault = 'claude-sonnet-4-5';
    const modelInput = await ask(`Model [${modelDefault}]: `);
    const model = modelInput || modelDefault;

    const augConf = {
      apiKey: apiKey || undefined,
      endpoint,
      model,
      enabled: !!apiKey,
    };

    const config = {
      ...(existingConfig || {}),
      promptAugmentor: { ...augConf, confidenceThreshold: 0.6, maxMatchedRules: 5, maxMatchedSkills: 3, timeoutMs: 10000 },
      skillMatcher: { ...augConf, confidenceThreshold: 0.6, maxSkillsPerRule: 3 },
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    if (apiKey) {
      console.log(`[8/8] Config written to ${configPath} (augmentation enabled).`);
    } else {
      console.log(`[8/8] Config written to ${configPath} (augmentation disabled).`);
    }
  }

  closeRl();
  console.log('\nclaude-habitat installed successfully.');
}

install().catch(console.error);
