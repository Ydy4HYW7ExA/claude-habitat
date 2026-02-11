export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export type Transport = (entry: LogEntry) => void;

export class Logger {
  private transports: Transport[] = [];
  private level: LogLevel;
  private context?: string;

  constructor(opts?: { level?: LogLevel; context?: string }) {
    this.level = opts?.level ?? 'info';
    this.context = opts?.context;
  }

  addTransport(transport: Transport): this {
    this.transports.push(transport);
    return this;
  }

  child(context: string): Logger {
    const child = new Logger({
      level: this.level,
      context: this.context ? `${this.context}.${context}` : context,
    });
    child.transports = this.transports;
    return child;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LEVELS[level] < LEVELS[this.level]) return;
    const entry: LogEntry = {
      level,
      message,
      context: this.context,
      timestamp: new Date().toISOString(),
      data,
    };
    for (const t of this.transports) {
      t(entry);
    }
  }
}

export function stderrTransport(entry: LogEntry): void {
  const prefix = entry.context ? `[${entry.context}]` : '';
  const msg = `${entry.timestamp} ${entry.level.toUpperCase()} ${prefix} ${entry.message}`;
  process.stderr.write(msg + '\n');
}
