import { describe, it, expect, vi } from 'vitest';
import { Logger, stderrTransport } from '../../src/logging/logger.js';

describe('Logger', () => {
  describe('child()', () => {
    it('creates child with concatenated context when parent has context', () => {
      const parent = new Logger({ level: 'debug', context: 'parent' });
      const calls: string[] = [];
      parent.addTransport((entry) => { calls.push(entry.context ?? ''); });

      const child = parent.child('child');
      child.info('test');

      expect(calls).toEqual(['parent.child']);
    });

    it('creates child with plain context when parent has no context', () => {
      const parent = new Logger({ level: 'debug' });
      const calls: string[] = [];
      parent.addTransport((entry) => { calls.push(entry.context ?? ''); });

      const child = parent.child('child');
      child.info('test');

      expect(calls).toEqual(['child']);
    });

    it('shares transports with parent', () => {
      const parent = new Logger({ level: 'debug' });
      const calls: string[] = [];
      parent.addTransport((entry) => { calls.push(entry.message); });

      const child = parent.child('ctx');
      child.info('from-child');
      parent.info('from-parent');

      expect(calls).toEqual(['from-child', 'from-parent']);
    });
  });

  describe('log level filtering', () => {
    it('defaults to info level when no opts provided', () => {
      const logger = new Logger();
      const calls: string[] = [];
      logger.addTransport((entry) => { calls.push(entry.level); });

      logger.debug('d');
      logger.info('i');

      expect(calls).toEqual(['info']);
    });

    it('filters messages below configured level', () => {
      const logger = new Logger({ level: 'warn' });
      const calls: string[] = [];
      logger.addTransport((entry) => { calls.push(entry.level); });

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      expect(calls).toEqual(['warn', 'error']);
    });

    it('passes all messages at debug level', () => {
      const logger = new Logger({ level: 'debug' });
      const calls: string[] = [];
      logger.addTransport((entry) => { calls.push(entry.level); });

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      expect(calls).toEqual(['debug', 'info', 'warn', 'error']);
    });
  });

  describe('transport chain', () => {
    it('calls all registered transports', () => {
      const logger = new Logger({ level: 'info' });
      const calls1: string[] = [];
      const calls2: string[] = [];
      logger.addTransport((entry) => { calls1.push(entry.message); });
      logger.addTransport((entry) => { calls2.push(entry.message); });

      logger.info('hello');

      expect(calls1).toEqual(['hello']);
      expect(calls2).toEqual(['hello']);
    });
  });
});

describe('stderrTransport', () => {
  it('writes formatted message to stderr with context', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    stderrTransport({
      level: 'info',
      message: 'hello world',
      context: 'myctx',
      timestamp: '2024-01-01T00:00:00.000Z',
    });

    expect(spy).toHaveBeenCalledWith(
      '2024-01-01T00:00:00.000Z INFO [myctx] hello world\n',
    );
    spy.mockRestore();
  });

  it('writes formatted message without context', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    stderrTransport({
      level: 'error',
      message: 'bad thing',
      timestamp: '2024-01-01T00:00:00.000Z',
    });

    expect(spy).toHaveBeenCalledWith(
      '2024-01-01T00:00:00.000Z ERROR  bad thing\n',
    );
    spy.mockRestore();
  });
});
