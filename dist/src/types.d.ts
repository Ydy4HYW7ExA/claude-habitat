/** Shared log function type — extracted to break circular dependency between ai/ and cli/. */
export type LogFn = (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
export { HabitatError, ValidationError, NotFoundError, SessionError, TimeoutError } from './errors.js';
//# sourceMappingURL=types.d.ts.map