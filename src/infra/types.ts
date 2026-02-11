export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface Envelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  errorDetails?: Record<string, unknown>;
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T = never>(error: string): Result<T> {
  return { ok: false, error };
}

export function envelope<T>(data: T): Envelope<T> {
  return { success: true, data };
}

export function envelopeError(
  error: string,
  code?: string,
  details?: Record<string, unknown>,
): Envelope {
  const env: Envelope = { success: false, error };
  if (code) env.errorCode = code;
  if (details) env.errorDetails = details;
  return env;
}
