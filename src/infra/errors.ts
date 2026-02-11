export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, 'NOT_FOUND', { entity, id });
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(message, 'VALIDATION_ERROR', { errors });
    this.name = 'ValidationError';
  }
}

export class DuplicateError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} already exists: ${id}`, 'DUPLICATE', { entity, id });
    this.name = 'DuplicateError';
  }
}

export class DependencyError extends AppError {
  constructor(message: string) {
    super(message, 'DEPENDENCY_ERROR');
    this.name = 'DependencyError';
  }
}
