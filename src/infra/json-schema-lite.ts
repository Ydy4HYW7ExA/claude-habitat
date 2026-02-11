export interface ValidationError {
  path: string;
  message: string;
}

export interface LiteSchema {
  type: 'object';
  properties?: Record<string, { type?: string }>;
  required?: string[];
}

export function validateJsonSchema(
  input: unknown,
  schema: LiteSchema,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    errors.push({ path: '', message: 'Input must be an object' });
    return errors;
  }

  const obj = input as Record<string, unknown>;

  if (schema.required) {
    for (const key of schema.required) {
      if (!(key in obj)) {
        errors.push({ path: key, message: `Missing required field: ${key}` });
      }
    }
  }

  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (!(key in obj) || obj[key] === undefined) continue;
      if (!prop.type) continue;

      const val = obj[key];
      const actual = Array.isArray(val) ? 'array' : typeof val;

      if (actual !== prop.type) {
        errors.push({
          path: key,
          message: `Expected ${prop.type}, got ${actual}`,
        });
      }
    }
  }

  return errors;
}
