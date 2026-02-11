export interface SkillMetadata {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  category?: string;
  difficulty?: string;
  tags?: string[];
  keywords?: string[];
  estimatedDuration?: number;
  prerequisites?: string[];
}

export type StepAnnotation =
  | { type: 'independent' }
  | { type: 'depends-on'; steps: number[] }
  | { type: 'user-decision' };

export interface SkillStep {
  number: number;
  name: string;
  description: string;
  annotations: StepAnnotation[];
  validation?: string;
  expectedOutcome?: string;
  qualityGate?: string;
}

export interface QualityGate {
  text: string;
  level: 'mandatory' | 'advisory';
}

export interface Pitfall {
  name: string;
  problem?: string;
  impact?: string;
  avoidance?: string;
  example?: string;
}

export interface SkillProtocol {
  name: string;
  description: string;
  steps: SkillStep[];
  imports: string[];
  rawContent: string;
  metadata?: SkillMetadata;
  context?: string;
  prerequisites: string[];
  qualityGates: QualityGate[];
  pitfalls: Pitfall[];
  relatedSkills: string[];
  notes: string[];
  successCriteria: string[];
}
