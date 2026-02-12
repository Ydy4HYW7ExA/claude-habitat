// Orchestration domain types

export interface HabitatEvent {
  id: string;
  type: string;
  sourcePositionId: string;
  targetPositionId?: string;
  payload: unknown;
  timestamp: number;
}

export type EventHandler = (event: HabitatEvent) => Promise<void>;

export interface EventFilter {
  type?: string;
  sourcePositionId?: string;
  targetPositionId?: string;
  since?: number;
  limit?: number;
}

export interface OrchestratorStatus {
  running: boolean;
  positions: { id: string; status: string; currentTask?: string }[];
  pendingTasks: number;
  completedTasks: number;
  totalCostUsd: number;
}

export interface ConcurrencyConfig {
  maxConcurrentPositions: number;
  maxConcurrentAiCalls: number;
  positionTimeout: number;
}
