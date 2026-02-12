import { nanoid } from 'nanoid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { EVENTS_DIR, NANOID_LENGTH_EVENT, EVENT_WILDCARD, ID_PREFIX, JSONL_EXT } from '../constants.js';
export class EventBus {
    handlers = new Map();
    wildcardHandlers = new Set();
    eventsDir;
    logger;
    constructor(baseDir, logger) {
        this.eventsDir = path.join(baseDir, EVENTS_DIR);
        this.logger = logger ?? ((level, msg) => {
            if (level === 'error')
                console.error(msg);
            else
                console.log(msg);
        });
    }
    on(eventType, handler) {
        if (eventType === EVENT_WILDCARD) {
            this.wildcardHandlers.add(handler);
            return;
        }
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }
        this.handlers.get(eventType).add(handler);
    }
    off(eventType, handler) {
        if (eventType === EVENT_WILDCARD) {
            this.wildcardHandlers.delete(handler);
            return;
        }
        this.handlers.get(eventType)?.delete(handler);
    }
    async emit(event) {
        // Persist event
        await this.persistEvent(event);
        // Notify specific handlers (error-isolated so one failure doesn't block others)
        const handlers = this.handlers.get(event.type);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    await handler(event);
                }
                catch (err) {
                    this.logger('error', `[EventBus] Handler error for '${event.type}': ${err}`);
                }
            }
        }
        // Notify wildcard handlers
        for (const handler of this.wildcardHandlers) {
            try {
                await handler(event);
            }
            catch (err) {
                this.logger('error', `[EventBus] Wildcard handler error for '${event.type}': ${err}`);
            }
        }
    }
    createEvent(type, sourcePositionId, payload, targetPositionId) {
        return {
            id: `${ID_PREFIX.EVENT}${nanoid(NANOID_LENGTH_EVENT)}`,
            type,
            sourcePositionId,
            targetPositionId,
            payload,
            timestamp: Date.now(),
        };
    }
    async getHistory(filter) {
        const events = [];
        let files;
        try {
            files = await fs.readdir(this.eventsDir);
        }
        catch {
            return [];
        }
        // Sort files chronologically
        files.sort();
        for (const file of files) {
            if (!file.endsWith(JSONL_EXT))
                continue;
            const filePath = path.join(this.eventsDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.trim().split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    const event = JSON.parse(line);
                    if (this.matchesFilter(event, filter)) {
                        events.push(event);
                    }
                }
                catch {
                    // Skip malformed lines
                }
            }
        }
        if (filter?.limit) {
            return events.slice(-filter.limit);
        }
        return events;
    }
    matchesFilter(event, filter) {
        if (!filter)
            return true;
        if (filter.type && event.type !== filter.type)
            return false;
        if (filter.sourcePositionId && event.sourcePositionId !== filter.sourcePositionId)
            return false;
        if (filter.targetPositionId && event.targetPositionId !== filter.targetPositionId)
            return false;
        if (filter.since && event.timestamp < filter.since)
            return false;
        return true;
    }
    async persistEvent(event) {
        await fs.mkdir(this.eventsDir, { recursive: true });
        const date = new Date(event.timestamp).toISOString().slice(0, 10);
        const filePath = path.join(this.eventsDir, `${date}.jsonl`);
        await fs.appendFile(filePath, JSON.stringify(event) + '\n');
    }
}
//# sourceMappingURL=event-bus.js.map