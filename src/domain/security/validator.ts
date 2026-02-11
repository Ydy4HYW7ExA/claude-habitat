import type { Logger } from '../../logging/logger.js';

export interface ThreatResult {
  safe: boolean;
  threats: string[];
}

const DANGEROUS_PATTERNS = [
  { pattern: /<script\b/i, name: 'XSS script tag' },
  { pattern: /javascript:/i, name: 'JavaScript URI' },
  { pattern: /on\w+\s*=/i, name: 'Event handler injection' },
  { pattern: /\.\.\//g, name: 'Path traversal' },
  { pattern: /\x00/g, name: 'Null byte injection' },
];

export class SecurityValidator {
  private maxInputLength: number;

  constructor(
    private logger: Logger,
    opts?: { maxInputLength?: number },
  ) {
    this.maxInputLength = opts?.maxInputLength ?? 100000;
  }

  validate(input: string): ThreatResult {
    const threats: string[] = [];

    if (input.length > this.maxInputLength) {
      threats.push(
        `Input exceeds max length (${input.length} > ${this.maxInputLength})`,
      );
    }

    for (const { pattern, name } of DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        threats.push(name);
      }
    }

    if (threats.length > 0) {
      this.logger.warn('Security threats detected', { threats });
    }

    return { safe: threats.length === 0, threats };
  }

  sanitize(input: string): string {
    let result = input;
    result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    result = result.replace(/javascript:/gi, '');
    result = result.replace(/\x00/g, '');
    return result.slice(0, this.maxInputLength);
  }
}
