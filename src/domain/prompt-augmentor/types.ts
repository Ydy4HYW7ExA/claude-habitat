// LLM-1 output
export interface ExtractionResult {
  keywords: string[];
  summary: string;
}

// LLM-2 output
export interface MatchingResult {
  matchedRules: MatchItem[];
  matchedSkills: MatchItem[];
}

export interface MatchItem {
  name: string;
  confidence: number;
  reasoning: string;
}

// Pipeline total output
export interface AugmentationResult {
  originalPrompt: string;
  extraction: ExtractionResult;
  matching: MatchingResult;
  augmentedPrompt: string;
}

// Abbreviated list entries sent to LLM-2
export interface AbbreviatedRule {
  name: string;
  description: string;
  content?: string;
  keywords?: string[];
}

export interface AbbreviatedSkill {
  name: string;
  description: string;
}

// Configuration
export interface PromptAugmentorConfig {
  apiKey?: string;
  model?: string;                // default: 'claude-sonnet-4-5'
  endpoint?: string;             // default: 'https://api.anthropic.com'
  confidenceThreshold?: number;  // default: 0.6
  maxMatchedRules?: number;      // default: 5
  maxMatchedSkills?: number;     // default: 3
  enabled?: boolean;             // default: true
  timeoutMs?: number;            // default: 10000
}
