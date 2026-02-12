import { ensureInitialized, createHabitatRuntime, onShutdown } from './runtime-factory.js';
import { DEFAULT_POLL_INTERVAL_MS, DEFAULT_CONCURRENCY_CONFIG, CLI_SOURCE_ID, DEFAULT_TASK_TYPE, TASK_PRIORITY, TASK_STATUS } from '../constants.js';
export async function runCommand(projectRoot, args) {
    const positionId = args[0];
    const taskType = args[1] ?? DEFAULT_TASK_TYPE;
    const payloadArg = args[2];
    if (!positionId) {
        console.error('Usage: claude-habitat run <position-id> [task-type] [payload-json]');
        process.exit(1);
    }
    await ensureInitialized(projectRoot);
    const { positionManager, orchestrator, config } = await createHabitatRuntime(projectRoot, {
        callFn: async (targetPositionId, taskType, payload) => {
            const dispatched = await orchestrator.dispatchTask({
                sourcePositionId: positionId,
                targetPositionId,
                type: taskType,
                payload,
                priority: TASK_PRIORITY.HIGH,
            });
            await orchestrator.triggerPosition(targetPositionId);
            return { taskId: dispatched.id };
        },
    });
    // Verify position exists
    const position = await positionManager.getPosition(positionId);
    if (!position) {
        console.error(`Position '${positionId}' not found.`);
        const all = await positionManager.listPositions();
        if (all.length > 0) {
            console.log('Available positions:', all.map(p => p.id).join(', '));
        }
        else {
            console.log('No positions created yet. Run: claude-habitat bootstrap');
        }
        process.exit(1);
    }
    // Parse payload
    let payload = {};
    if (payloadArg) {
        try {
            payload = JSON.parse(payloadArg);
        }
        catch {
            payload = { input: payloadArg };
        }
    }
    onShutdown(orchestrator);
    await orchestrator.start();
    console.log(`Running position '${positionId}' with task '${taskType}'...`);
    const task = await orchestrator.dispatchTask({
        sourcePositionId: CLI_SOURCE_ID,
        targetPositionId: positionId,
        type: taskType,
        payload,
        priority: TASK_PRIORITY.NORMAL,
    });
    // Wait for task completion (simple polling)
    const concurrency = config.concurrency;
    const timeout = concurrency?.positionTimeout ?? DEFAULT_CONCURRENCY_CONFIG.positionTimeout;
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const pos = await positionManager.getPosition(positionId);
        if (!pos)
            break;
        const t = pos.taskQueue.find(t => t.id === task.id);
        if (t && (t.status === TASK_STATUS.DONE || t.status === TASK_STATUS.FAILED)) {
            if (t.status === TASK_STATUS.DONE) {
                console.log('Task completed successfully.');
                if (t.result) {
                    console.log('Result:', JSON.stringify(t.result, null, 2));
                }
            }
            else {
                console.error('Task failed:', t.result);
            }
            break;
        }
        await new Promise(r => setTimeout(r, DEFAULT_POLL_INTERVAL_MS));
    }
    await orchestrator.stop();
}
//# sourceMappingURL=run.js.map