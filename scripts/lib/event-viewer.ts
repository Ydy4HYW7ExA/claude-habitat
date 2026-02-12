/**
 * EventViewer — 实时事件流格式化输出 + JSONL 回放
 */
import type { EventBus } from '../../src/orchestration/event-bus.js';
import type { HabitatEvent, EventHandler } from '../../src/orchestration/types.js';
import { EVENT_WILDCARD } from '../../src/constants.js';
import * as fs from 'node:fs/promises';

// ANSI color codes
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function colorForType(type: string): string {
  if (type.includes('created')) return CYAN;
  if (type.includes('completed')) return GREEN;
  if (type.includes('failed')) return RED;
  return YELLOW;
}

function formatEvent(event: HabitatEvent, startTime: number): string {
  const elapsed = event.timestamp - startTime;
  const ms = String(elapsed).padStart(6);
  const color = colorForType(event.type);
  const type = event.type.padEnd(20);

  let route = event.sourcePositionId ?? '';
  if (event.targetPositionId) {
    route += ` → ${event.targetPositionId}`;
  }
  route = route.padEnd(24);

  const payload = JSON.stringify(event.payload);
  return `${DIM}[+${ms}ms]${RESET} ${color}${type}${RESET} ${route} ${DIM}${payload}${RESET}`;
}

export class EventViewer {
  private handler: EventHandler | null = null;
  private events: HabitatEvent[] = [];
  private startTime = Date.now();

  constructor(private eventBus: EventBus) {}

  start(): void {
    this.startTime = Date.now();
    this.handler = async (event: HabitatEvent) => {
      this.events.push(event);
      console.log(formatEvent(event, this.startTime));
    };
    this.eventBus.on(EVENT_WILDCARD, this.handler);
  }

  stop(): void {
    if (this.handler) {
      this.eventBus.off(EVENT_WILDCARD, this.handler);
      this.handler = null;
    }
  }

  getCollected(): HabitatEvent[] {
    return [...this.events];
  }

  /** Replay events from a JSONL file */
  async replay(jsonlPath: string): Promise<void> {
    const content = await fs.readFile(jsonlPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return;

    const events = lines.map(l => JSON.parse(l) as HabitatEvent);
    const replayStart = events[0].timestamp;

    console.log(`\n${CYAN}── 事件回放 (${events.length} events from ${jsonlPath}) ──${RESET}\n`);
    for (const event of events) {
      console.log(formatEvent(event, replayStart));
    }
  }
}
