export type FieldRule =
  | { type: 'string'; required?: boolean; max?: number; min?: number; pattern?: RegExp }
  | { type: 'number'; required?: boolean; min?: number; max?: number }
  | {
      type: 'array';
      required?: boolean;
      minItems?: number;
      maxItems?: number;
      item?: FieldRule;
    }
  | { type: 'enum'; values: string[]; required?: boolean }
  | { type: 'boolean'; required?: boolean }
  | { type: 'custom'; check: (v: unknown) => string | null; required?: boolean };

export type Schema = Record<string, FieldRule>;

export function validate(data: Record<string, unknown>, schema: Schema): string[] {
  const errors: string[] = [];

  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field];
    const isPresent = value !== undefined && value !== null;

    if (rule.required !== false && !isPresent) {
      errors.push(`${field} is required`);
      continue;
    }

    if (!isPresent) continue;

    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${field} must be a string`);
        } else {
          if (rule.min !== undefined && value.length < rule.min)
            errors.push(`${field} must be at least ${rule.min} characters`);
          if (rule.max !== undefined && value.length > rule.max)
            errors.push(`${field} must be at most ${rule.max} characters`);
          if (rule.pattern && !rule.pattern.test(value))
            errors.push(`${field} has invalid format`);
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          errors.push(`${field} must be a number`);
        } else {
          if (rule.min !== undefined && value < rule.min)
            errors.push(`${field} must be >= ${rule.min}`);
          if (rule.max !== undefined && value > rule.max)
            errors.push(`${field} must be <= ${rule.max}`);
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`${field} must be an array`);
        } else {
          if (rule.minItems !== undefined && value.length < rule.minItems)
            errors.push(`${field} must have at least ${rule.minItems} items`);
          if (rule.maxItems !== undefined && value.length > rule.maxItems)
            errors.push(`${field} must have at most ${rule.maxItems} items`);
          if (rule.item) {
            for (let i = 0; i < value.length; i++) {
              const itemErrors = validate(
                { [`${field}[${i}]`]: value[i] },
                { [`${field}[${i}]`]: rule.item },
              );
              errors.push(...itemErrors);
            }
          }
        }
        break;

      case 'enum':
        if (!rule.values.includes(value as string))
          errors.push(`${field} must be one of: ${rule.values.join(', ')}`);
        break;

      case 'boolean':
        if (typeof value !== 'boolean') errors.push(`${field} must be a boolean`);
        break;

      case 'custom': {
        const err = rule.check(value);
        if (err) errors.push(`${field}: ${err}`);
        break;
      }
    }
  }

  return errors;
}

export function assertValid(data: Record<string, unknown>, schema: Schema): void {
  const errors = validate(data, schema);
  if (errors.length > 0) {
    throw new ValidatorError('Validation failed', errors);
  }
}

export class ValidatorError extends Error {
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(`${message}: ${errors.join('; ')}`);
    this.name = 'ValidatorError';
  }
}
