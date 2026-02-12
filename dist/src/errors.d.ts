/** Unified error hierarchy for Claude Habitat. */
export declare class HabitatError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
export declare class ValidationError extends HabitatError {
    constructor(message: string, options?: ErrorOptions);
}
export declare class NotFoundError extends HabitatError {
    constructor(message: string, options?: ErrorOptions);
}
export declare class SessionError extends HabitatError {
    constructor(message: string, options?: ErrorOptions);
}
export declare class TimeoutError extends HabitatError {
    constructor(message: string, options?: ErrorOptions);
}
//# sourceMappingURL=errors.d.ts.map