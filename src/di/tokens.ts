import { createToken } from './container.js';
import type { Logger } from '../logging/logger.js';
import type { Container } from './container.js';
import type { DocumentService } from '../domain/document/service.js';
import type { WorkflowService } from '../domain/workflow/service.js';
import type { SkillParser } from '../domain/skill/parser.js';
import type { RuleEngine } from '../domain/rule/engine.js';
import type { RuleLoader } from '../domain/rule/loader.js';
import type { HookExecutor } from '../domain/hook/executor.js';
import type { CommandRegistry } from '../domain/command/registry.js';
import type { PluginManager } from '../domain/plugin/manager.js';
import type { SecurityValidator } from '../domain/security/validator.js';
import type { RateLimiter } from '../domain/security/rate-limiter.js';
import type { ConfigLoader } from '../domain/config/loader.js';
import type { HabitatFileService } from '../domain/habitat-files/service.js';
import type { SkillMatcher } from '../domain/skill-matcher/matcher.js';
import type { PromptAugmentor } from '../domain/prompt-augmentor/augmentor.js';
import type { SessionTracker } from '../domain/session/tracker.js';
import type { McpBridgeManager } from '../domain/bridge/manager.js';

// Infrastructure
export const Tokens = {
  Logger: createToken<Logger>('Logger'),
  HabitatDir: createToken<string>('HabitatDir'),

  // Domain services
  DocumentService: createToken<DocumentService>('DocumentService'),
  WorkflowService: createToken<WorkflowService>('WorkflowService'),
  SkillParser: createToken<SkillParser>('SkillParser'),
  RuleEngine: createToken<RuleEngine>('RuleEngine'),
  RuleLoader: createToken<RuleLoader>('RuleLoader'),
  HookExecutor: createToken<HookExecutor>('HookExecutor'),
  CommandRegistry: createToken<CommandRegistry>('CommandRegistry'),
  PluginManager: createToken<PluginManager>('PluginManager'),
  SecurityValidator: createToken<SecurityValidator>('SecurityValidator'),
  RateLimiter: createToken<RateLimiter>('RateLimiter'),
  ConfigLoader: createToken<ConfigLoader>('ConfigLoader'),
  HabitatFileService: createToken<HabitatFileService>('HabitatFileService'),
  SkillMatcher: createToken<SkillMatcher>('SkillMatcher'),
  PromptAugmentor: createToken<PromptAugmentor>('PromptAugmentor'),
  SessionTracker: createToken<SessionTracker>('SessionTracker'),
  McpBridgeManager: createToken<McpBridgeManager>('McpBridgeManager'),

  // MCP
  Container: createToken<Container>('Container'),
} as const;
