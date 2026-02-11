import type { SkillMatcherConfig } from '../skill-matcher/types.js';
import type { PromptAugmentorConfig } from '../prompt-augmentor/types.js';
import type { BridgeConfig } from '../bridge/types.js';

export interface HabitatConfig {
  projectName?: string;
  projectId?: string;
  version?: string;
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
  };
  security?: {
    rateLimit?: {
      maxRequests: number;
      windowMs: number;
    };
    maxInputLength?: number;
  };
  documents?: {
    maxTags?: number;
    minTags?: number;
    maxKeywords?: number;
    maxNameLength?: number;
    maxSummaryLength?: number;
  };
  workflows?: {
    maxDepth?: number;
    maxNodes?: number;
  };
  skillMatcher?: SkillMatcherConfig;
  promptAugmentor?: PromptAugmentorConfig;
  bridge?: BridgeConfig;
}

export const DEFAULT_CONFIG: HabitatConfig = {
  version: '1.0.0',
  logging: { level: 'info' },
  security: {
    rateLimit: { maxRequests: 100, windowMs: 60000 },
    maxInputLength: 100000,
  },
  documents: {
    maxTags: 8,
    minTags: 2,
    maxKeywords: 50,
    maxNameLength: 200,
    maxSummaryLength: 500,
  },
  workflows: {
    maxDepth: 10,
    maxNodes: 1000,
  },
  skillMatcher: {
    model: 'claude-sonnet-4-5',
    endpoint: 'https://api.anthropic.com',
    confidenceThreshold: 0.6,
    maxSkillsPerRule: 3,
    enabled: true,
  },
  promptAugmentor: {
    model: 'claude-sonnet-4-5',
    endpoint: 'https://api.anthropic.com',
    confidenceThreshold: 0.6,
    maxMatchedRules: 5,
    maxMatchedSkills: 3,
    enabled: true,
    timeoutMs: 10000,
  },
};
