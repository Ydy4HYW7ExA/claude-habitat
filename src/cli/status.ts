import * as path from 'node:path';
import { ensureInitialized } from './runtime-factory.js';
import { PositionManager } from '../position/manager.js';
import { FileMemoryStoreFactory } from '../memory/factory.js';
import { EventBus } from '../orchestration/event-bus.js';
import { MEMORY_DIR, SUMMARY_MAX_LENGTH, formatTimestamp, DEFAULT_STATUS_EVENT_LIMIT, TASK_STATUS } from '../constants.js';

export async function status(projectRoot: string): Promise<void> {
  const habitatDir = await ensureInitialized(projectRoot);

  const positionManager = new PositionManager(habitatDir);
  const memoryFactory = new FileMemoryStoreFactory(path.join(habitatDir, MEMORY_DIR));
  const eventBus = new EventBus(habitatDir);

  // Positions
  const positions = await positionManager.listPositions();
  console.log('=== Claude Habitat Status ===');
  console.log('');

  if (positions.length === 0) {
    console.log('Positions: (none)');
    console.log('Run "claude-habitat bootstrap" to create your AI team.');
  } else {
    console.log(`Positions (${positions.length}):`);
    for (const pos of positions) {
      const pendingTasks = pos.taskQueue.filter(t => t.status === TASK_STATUS.PENDING).length;
      const doneTasks = pos.taskQueue.filter(t => t.status === TASK_STATUS.DONE).length;
      const failedTasks = pos.taskQueue.filter(t => t.status === TASK_STATUS.FAILED).length;
      console.log(`  ${pos.id} (${pos.roleTemplateName}) — ${pos.status}`);
      console.log(`    Tasks: ${pendingTasks} pending, ${doneTasks} done, ${failedTasks} failed`);
    }
  }

  // Role templates
  const templates = await positionManager.listRoleTemplates();
  console.log('');
  console.log(`Role Templates (${templates.length}):`);
  for (const tmpl of templates) {
    console.log(`  ${tmpl.name} — ${tmpl.description.slice(0, SUMMARY_MAX_LENGTH)}`);
  }

  // Global memory stats
  const globalStore = memoryFactory.getGlobalStore();
  try {
    const stats = await globalStore.getStats();
    console.log('');
    console.log('Global Memory:');
    console.log(`  Total: ${stats.totalEntries} entries`);
    console.log(`  Episodes: ${stats.byLayer.episode}, Traces: ${stats.byLayer.trace}, Categories: ${stats.byLayer.category}, Insights: ${stats.byLayer.insight}`);
  } catch {
    console.log('');
    console.log('Global Memory: (empty)');
  }

  // Recent events
  const recentEvents = await eventBus.getHistory({ limit: DEFAULT_STATUS_EVENT_LIMIT });
  console.log('');
  if (recentEvents.length > 0) {
    console.log('Recent Events:');
    for (const event of recentEvents) {
      const time = formatTimestamp(new Date(event.timestamp));
      console.log(`  [${time}] ${event.type} (${event.sourcePositionId})`);
    }
  } else {
    console.log('Recent Events: (none)');
  }
}
