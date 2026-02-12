import type { HabitatEvent, EventHandler, EventFilter } from './types.js';
import type { LogFn } from '../types.js';
export declare class EventBus {
    private handlers;
    private wildcardHandlers;
    private eventsDir;
    private logger;
    constructor(baseDir: string, logger?: LogFn);
    on(eventType: string, handler: EventHandler): void;
    off(eventType: string, handler: EventHandler): void;
    emit(event: HabitatEvent): Promise<void>;
    createEvent(type: string, sourcePositionId: string, payload: unknown, targetPositionId?: string): HabitatEvent;
    getHistory(filter?: EventFilter): Promise<HabitatEvent[]>;
    private matchesFilter;
    private persistEvent;
}
//# sourceMappingURL=event-bus.d.ts.map