export interface SkillMatchResult {
  skillName: string;
  confidence: number; // 0.0 - 1.0
  reasoning: string;
}

export interface SkillSummary {
  name: string;
  description: string;
  tags: string[];
  category?: string;
}

export interface SkillMatcherConfig {
  apiKey?: string;
  model?: string; // default: 'claude-sonnet-4-5'
  endpoint?: string; // default: 'https://api.anthropic.com'
  confidenceThreshold?: number; // default: 0.6
  maxSkillsPerRule?: number; // default: 3
  enabled?: boolean; // default: true
}
