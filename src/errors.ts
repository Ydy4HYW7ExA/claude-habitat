/** Unified error hierarchy for Claude Habitat. */

export class HabitatError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'HabitatError';
  }
}

export class ValidationError extends HabitatError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends HabitatError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'NotFoundError';
  }
}

export class SessionError extends HabitatError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SessionError';
  }
}

export class TimeoutError extends HabitatError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'TimeoutError';
  }
}
