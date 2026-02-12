import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../../src/orchestration/event-bus.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { EVENT_TYPE, EVENT_WILDCARD, ID_PREFIX } from '../../src/constants.js';
describe('EventBus', () => {
    let tmpDir;
    let bus;
    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'evtbus-test-'));
        bus = new EventBus(tmpDir);
    });
    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
    it('should create events with unique IDs', () => {
        const e1 = bus.createEvent(EVENT_TYPE.TASK_CREATED, 'pos-1', { data: 1 });
        const e2 = bus.createEvent(EVENT_TYPE.TASK_CREATED, 'pos-1', { data: 2 });
        expect(e1.id).toMatch(new RegExp('^' + ID_PREFIX.EVENT));
        expect(e1.id).not.toBe(e2.id);
        expect(e1.type).toBe(EVENT_TYPE.TASK_CREATED);
        expect(e1.sourcePositionId).toBe('pos-1');
    });
    it('should notify handlers for matching event type', async () => {
        const received = [];
        bus.on(EVENT_TYPE.TASK_CREATED, async (event) => { received.push(event); });
        const event = bus.createEvent(EVENT_TYPE.TASK_CREATED, 'pos-1', { data: 1 });
        await bus.emit(event);
        expect(received).toHaveLength(1);
        expect(received[0].type).toBe(EVENT_TYPE.TASK_CREATED);
    });
    it('should not notify handlers for non-matching event type', async () => {
        const received = [];
        bus.on(EVENT_TYPE.TASK_COMPLETED, async (event) => { received.push(event); });
        const event = bus.createEvent(EVENT_TYPE.TASK_CREATED, 'pos-1', { data: 1 });
        await bus.emit(event);
        expect(received).toHaveLength(0);
    });
    it('should notify wildcard handlers for all events', async () => {
        const received = [];
        bus.on(EVENT_WILDCARD, async (event) => { received.push(event); });
        await bus.emit(bus.createEvent(EVENT_TYPE.TASK_CREATED, 'pos-1', {}));
        await bus.emit(bus.createEvent(EVENT_TYPE.TASK_COMPLETED, 'pos-2', {}));
        expect(received).toHaveLength(2);
    });
    it('should unregister handlers', async () => {
        const received = [];
        const handler = async (event) => { received.push(event); };
        bus.on(EVENT_TYPE.TASK_CREATED, handler);
        await bus.emit(bus.createEvent(EVENT_TYPE.TASK_CREATED, 'pos-1', {}));
        expect(received).toHaveLength(1);
        bus.off(EVENT_TYPE.TASK_CREATED, handler);
        await bus.emit(bus.createEvent(EVENT_TYPE.TASK_CREATED, 'pos-1', {}));
        expect(received).toHaveLength(1); // No new events
    });
    it('should unregister wildcard handlers', async () => {
        const received = [];
        const handler = async (event) => { received.push(event); };
        bus.on(EVENT_WILDCARD, handler);
        await bus.emit(bus.createEvent('test', 'pos-1', {}));
        expect(received).toHaveLength(1);
        bus.off(EVENT_WILDCARD, handler);
        await bus.emit(bus.createEvent('test', 'pos-1', {}));
        expect(received).toHaveLength(1);
    });
    it('should persist events to JSONL files', async () => {
        await bus.emit(bus.createEvent(EVENT_TYPE.TASK_CREATED, 'pos-1', { data: 1 }));
        await bus.emit(bus.createEvent(EVENT_TYPE.TASK_COMPLETED, 'pos-2', { data: 2 }));
        const history = await bus.getHistory();
        expect(history).toHaveLength(2);
        expect(history[0].type).toBe(EVENT_TYPE.TASK_CREATED);
        expect(history[1].type).toBe(EVENT_TYPE.TASK_COMPLETED);
    });
    it('should filter history by type', async () => {
        await bus.emit(bus.createEvent(EVENT_TYPE.TASK_CREATED, 'pos-1', {}));
        await bus.emit(bus.createEvent(EVENT_TYPE.TASK_COMPLETED, 'pos-2', {}));
        const history = await bus.getHistory({ type: EVENT_TYPE.TASK_CREATED });
        expect(history).toHaveLength(1);
        expect(history[0].type).toBe(EVENT_TYPE.TASK_CREATED);
    });
    it('should filter history by sourcePositionId', async () => {
        await bus.emit(bus.createEvent(EVENT_TYPE.TASK_CREATED, 'pos-1', {}));
        await bus.emit(bus.createEvent(EVENT_TYPE.TASK_CREATED, 'pos-2', {}));
        const history = await bus.getHistory({ sourcePositionId: 'pos-1' });
        expect(history).toHaveLength(1);
    });
    it('should filter history by since timestamp', async () => {
        const before = Date.now();
        await bus.emit(bus.createEvent('old', 'pos-1', {}));
        await new Promise(r => setTimeout(r, 10));
        const after = Date.now();
        await bus.emit(bus.createEvent('new', 'pos-1', {}));
        const history = await bus.getHistory({ since: after });
        expect(history).toHaveLength(1);
        expect(history[0].type).toBe('new');
    });
    it('should limit history results', async () => {
        for (let i = 0; i < 5; i++) {
            await bus.emit(bus.createEvent(`event-${i}`, 'pos-1', {}));
        }
        const history = await bus.getHistory({ limit: 2 });
        expect(history).toHaveLength(2);
    });
    it('should emit to both specific and wildcard handlers', async () => {
        const received = [];
        bus.on('broadcast-test', async () => { received.push('specific'); });
        bus.on(EVENT_WILDCARD, async () => { received.push('wildcard'); });
        await bus.emit(bus.createEvent('broadcast-test', 'pos-1', {}));
        expect(received).toEqual(['specific', 'wildcard']);
    });
    it('should return empty history when no events dir', async () => {
        const emptyBus = new EventBus(path.join(tmpDir, 'nonexistent'));
        const history = await emptyBus.getHistory();
        expect(history).toEqual([]);
    });
});
//# sourceMappingURL=event-bus.test.js.map