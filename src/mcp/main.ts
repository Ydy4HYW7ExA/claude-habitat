import { join } from 'node:path';
import { Container } from '../di/container.js';
import { Tokens } from '../di/tokens.js';
import { JsonStore } from '../infra/json-store.js';
import { Logger, stderrTransport } from '../logging/logger.js';
import { DocumentService } from '../domain/document/service.js';
import { WorkflowService } from '../domain/workflow/service.js';
import { SkillParser } from '../domain/skill/parser.js';
import { ConfigLoader } from '../domain/config/loader.js';
import { SecurityValidator } from '../domain/security/validator.js';
import { RateLimiter } from '../domain/security/rate-limiter.js';
import { RuleEngine } from '../domain/rule/engine.js';
import { RuleLoader } from '../domain/rule/loader.js';
import { HookExecutor } from '../domain/hook/executor.js';
import { createBuiltinHooks } from '../domain/hook/builtins.js';
import { CommandRegistry } from '../domain/command/registry.js';
import { PluginManager } from '../domain/plugin/manager.js';
import { SkillMatcher } from '../domain/skill-matcher/matcher.js';
import { SessionTracker } from '../domain/session/tracker.js';
import { createPromptAugmentationHook } from '../domain/hook/prompt-augmentation.js';
import { PromptAugmentor } from '../domain/prompt-augmentor/augmentor.js';
import { McpBridgeManager } from '../domain/bridge/manager.js';
import { McpServer } from './server.js';
import type { ToolMetadata } from './define-tool.js';
import { envelope, envelopeError } from '../infra/types.js';
import { registerProjectTools } from './tools/project.js';
import { registerDocumentTools } from './tools/document.js';
import { registerWorkflowTools } from './tools/workflow.js';
import { registerSkillTools } from './tools/skill.js';
import { registerHabitatCommandTools } from './tools/habitat-command.js';
import { registerHabitatSkillTools } from './tools/habitat-skill.js';
import { registerHabitatRuleTools } from './tools/habitat-rule.js';
import { registerSessionTools } from './tools/session.js';
import { registerBridgeManagementTools } from './tools/bridge-management.js';
import { HabitatFileService } from '../domain/habitat-files/service.js';
import type { Document } from '../domain/document/types.js';
import type { WorkflowTree } from '../domain/workflow/types.js';
import type { ExecutionState } from '../domain/workflow/types.js';

export interface BootstrapOptions {
  skillsDir?: string;
}

export async function bootstrap(
  habitatDir: string,
  options?: BootstrapOptions,
): Promise<McpServer> {
  const container = new Container();

  // Logger
  const logger = new Logger({ level: 'info' });
  logger.addTransport(stderrTransport);
  container.register(Tokens.Logger, () => logger);
  container.register(Tokens.HabitatDir, () => habitatDir);

  // Config
  const configLoader = new ConfigLoader();
  const config = await configLoader.load(habitatDir);
  container.register(Tokens.ConfigLoader, () => configLoader);

  // Document service
  const docStore = new JsonStore<Document>(join(habitatDir, 'documents'));
  await docStore.ensureDir();
  container.register(Tokens.DocumentService, () =>
    new DocumentService(docStore, logger.child('doc'), config.documents),
  );

  // Workflow service
  type TreeEnvelope = { version: string; timestamp: number; tree: WorkflowTree };
  const treeStore = new JsonStore<TreeEnvelope>(join(habitatDir, 'workflows'));
  const stateStore = new JsonStore<ExecutionState>(join(habitatDir, 'workflow-states'));
  await treeStore.ensureDir();
  await stateStore.ensureDir();
  container.register(Tokens.WorkflowService, () =>
    new WorkflowService(treeStore, stateStore, logger.child('wf'), config.workflows),
  );

  // Skill parser — prefer installed skills dir if provided
  const skillsDir = options?.skillsDir ?? HABITAT_SKILLS_DIR;
  container.register(Tokens.SkillParser, () =>
    new SkillParser(skillsDir),
  );

  // Security
  container.register(Tokens.SecurityValidator, () =>
    new SecurityValidator(logger.child('security'), {
      maxInputLength: config.security?.maxInputLength,
    }),
  );
  container.register(Tokens.RateLimiter, () =>
    new RateLimiter(
      config.security?.rateLimit?.maxRequests ?? 100,
      config.security?.rateLimit?.windowMs ?? 60000,
    ),
  );

  // Rule system
  container.register(Tokens.RuleEngine, () =>
    new RuleEngine(logger.child('rule')),
  );
  container.register(Tokens.RuleLoader, (c) => {
    const loader = new RuleLoader(c.resolve(Tokens.RuleEngine));
    loader.loadBuiltins();
    return loader;
  });

  // Load habitat rules asynchronously after registration
  const ruleLoader = container.resolve(Tokens.RuleLoader);
  await ruleLoader.loadFromDir(HABITAT_RULES_DIR);

  // Hook system
  container.register(Tokens.HookExecutor, () => {
    const executor = new HookExecutor(logger.child('hook'));
    for (const hook of createBuiltinHooks(logger.child('hook'))) {
      executor.register(hook);
    }
    return executor;
  });

  // Command, Plugin, Knowledge
  container.register(Tokens.CommandRegistry, () => new CommandRegistry());
  container.register(Tokens.PluginManager, () =>
    new PluginManager(logger.child('plugin')),
  );

  // SkillMatcher (AI semantic matching)
  container.register(Tokens.SkillMatcher, () =>
    new SkillMatcher(config.skillMatcher ?? {}, logger.child('skill-matcher')),
  );

  // SessionTracker (in-memory session stats)
  container.register(Tokens.SessionTracker, () =>
    new SessionTracker(logger.child('session')),
  );

  // Habitat file service
  container.register(Tokens.HabitatFileService, () =>
    new HabitatFileService(
      habitatDir, CLAUDE_DIR, logger.child('habitat-files'),
      container.resolve(Tokens.SkillMatcher),
      container.resolve(Tokens.RuleEngine),
    ),
  );

  // PromptAugmentor (two-stage LLM pipeline for prompt augmentation)
  const promptAugmentorConfig = config.promptAugmentor ?? config.skillMatcher ?? {};
  container.register(Tokens.PromptAugmentor, () =>
    new PromptAugmentor(promptAugmentorConfig, logger.child('prompt-augmentor')),
  );

  container.register(Tokens.Container, () => container);

  // Register PromptAugmentationHook on the HookExecutor
  const hookExecutor = container.resolve(Tokens.HookExecutor);
  hookExecutor.register(createPromptAugmentationHook({
    promptAugmentor: container.resolve(Tokens.PromptAugmentor),
    ruleEngine: container.resolve(Tokens.RuleEngine),
    sessionTracker: container.resolve(Tokens.SessionTracker),
    skillsDir,
    logger: logger.child('prompt-augmentation'),
  }));

  // MCP Server (with HookExecutor for runtime rule injection)
  const server = new McpServer(
    'claude-habitat',
    config.version ?? '1.0.0',
    logger.child('mcp'),
    hookExecutor,
  );

  // Security middleware
  const rateLimiter = container.resolve(Tokens.RateLimiter);
  const securityValidator = container.resolve(Tokens.SecurityValidator);

  server.use((toolName) => {
    if (!rateLimiter.tryAcquire(toolName)) {
      return envelopeError(`Rate limit exceeded for tool: ${toolName}`);
    }
    return null;
  });

  server.use((_toolName, input) => {
    const result = securityValidator.validate(JSON.stringify(input));
    if (!result.safe) {
      return envelopeError(`Security check failed: ${result.threats.join(', ')}`);
    }
    return null;
  });

  server.registerTools(registerProjectTools(container));
  server.registerTools(registerDocumentTools(container));
  server.registerTools(registerWorkflowTools(container));
  server.registerTools(registerSkillTools(container));
  server.registerTools(registerHabitatCommandTools(container));
  server.registerTools(registerHabitatSkillTools(container));
  server.registerTools(registerHabitatRuleTools(container));
  server.registerTools(registerSessionTools(container));
  server.registerTools(registerBridgeManagementTools(container));

  // Bridge manager — proxy external MCP servers
  const bridgeManager = new McpBridgeManager(
    config.bridge ?? {},
    logger.child('bridge'),
  );
  await bridgeManager.startAll();
  container.register(Tokens.McpBridgeManager, () => bridgeManager);

  for (const bt of bridgeManager.getAllTools()) {
    server.registerTool({
      name: bt.name,
      description: `[${bt.originServer}] ${bt.description}`,
      schema: bt.inputSchema as ToolMetadata['schema'],
      async execute(input) {
        const result = await bridgeManager.callTool(bt.originServer, bt.name, input as Record<string, unknown>);
        return envelope(result);
      },
    });
  }

  return server;
}

// Self-executing startup when run directly
import { HABITAT_DIR, HABITAT_SKILLS_DIR, HABITAT_RULES_DIR, CLAUDE_DIR } from '../preset/constants.js';

bootstrap(HABITAT_DIR, { skillsDir: HABITAT_SKILLS_DIR })
  .then((s) => s.start())
  .catch((err) => {
    process.stderr.write(`claude-habitat failed to start: ${err}\n`);
    process.exit(1);
  });
