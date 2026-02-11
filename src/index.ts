// DI
export { Container, createToken } from './di/container.js';
export type { Token, Disposable } from './di/container.js';
export { Tokens } from './di/tokens.js';

// Infrastructure
export { JsonStore } from './infra/json-store.js';
export type { StoreOptions } from './infra/json-store.js';
export { MultiMap } from './infra/multi-map.js';
export { traverse, findNode, findById, collectNodes, countNodes } from './infra/tree.js';
export type { TreeNode, VisitorCallbacks } from './infra/tree.js';
export { validate, assertValid, ValidatorError } from './infra/validator.js';
export type { FieldRule, Schema } from './infra/validator.js';
export { query } from './infra/query.js';
export type { QueryOptions, QueryResult } from './infra/query.js';
export { IntegrityChecker } from './infra/integrity.js';
export type { Issue, Report, Check } from './infra/integrity.js';
export { ok, err, envelope, envelopeError } from './infra/types.js';
export type { Result, Envelope } from './infra/types.js';
export { AppError, NotFoundError, ValidationError, DuplicateError, DependencyError } from './infra/errors.js';

// Domain — Document
export { DocumentService } from './domain/document/service.js';
export type { Document, DocumentMetadata, CreateDocumentInput, UpdateDocumentInput } from './domain/document/types.js';

// Domain — Workflow
export { WorkflowService } from './domain/workflow/service.js';
export type {
  WorkflowNode, WorkflowTree, WorkflowCursor, WorkflowExecutionState,
  TodoItem, TreeSummary, TransitionAction, TreeUpdateOp,
  NodeType, NodeStatus,
} from './domain/workflow/types.js';

// Domain — Skill
export { SkillParser } from './domain/skill/parser.js';
export type { SkillProtocol, SkillStep, SkillMetadata } from './domain/skill/types.js';

// Domain — Habitat Files
export { HabitatFileService } from './domain/habitat-files/service.js';
export type { HabitatScope, HabitatFileKind, HabitatFileInfo } from './domain/habitat-files/types.js';

// Domain — Config
export type { HabitatConfig } from './domain/config/types.js';
export { DEFAULT_CONFIG } from './domain/config/types.js';

// Domain — SkillMatcher
export { SkillMatcher } from './domain/skill-matcher/matcher.js';
export type { SkillMatchResult, SkillSummary, SkillMatcherConfig } from './domain/skill-matcher/types.js';

// Domain — SessionTracker
export { SessionTracker } from './domain/session/tracker.js';
export type { SessionStats, RuleTriggerRecord, SkillInvocationRecord } from './domain/session/types.js';

// Domain — Hooks
export { createRuleEnforcementHook } from './domain/hook/rule-enforcement.js';
export { createPromptAugmentationHook } from './domain/hook/prompt-augmentation.js';
export type { PromptAugmentationHook } from './domain/hook/prompt-augmentation.js';

// Domain — PromptAugmentor
export { PromptAugmentor } from './domain/prompt-augmentor/augmentor.js';
export { getAbbreviatedRules, getAbbreviatedSkills } from './domain/prompt-augmentor/list-providers.js';
export type {
  PromptAugmentorConfig, ExtractionResult, MatchingResult,
  MatchItem, AugmentationResult, AbbreviatedRule, AbbreviatedSkill,
} from './domain/prompt-augmentor/types.js';

// Domain — Bridge
export { McpBridge } from './domain/bridge/bridge.js';
export { McpBridgeManager } from './domain/bridge/manager.js';
export type { BridgeServerConfig, BridgeConfig, BridgedTool } from './domain/bridge/types.js';

// Logging
export { Logger } from './logging/logger.js';

// MCP
export { McpServer } from './mcp/server.js';

// Preset — Symlinker
export { syncSymlinks, removeSymlinks, ensureSymlink, removeSymlink } from './preset/symlinker.js';

// Preset — Installer (injection)
export { injectMarkerSection, removeMarkerSection } from './preset/installer.js';

// Preset — Constants
export {
  HABITAT_COMMANDS_DIR, HABITAT_SKILLS_DIR, HABITAT_RULES_DIR,
  HABITAT_BEGIN_MARKER, HABITAT_END_MARKER,
} from './preset/constants.js';
