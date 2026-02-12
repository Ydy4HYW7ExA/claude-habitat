import { describe, it, expect } from 'vitest';
import { MessageChannel } from '../../src/ai/message-channel.js';

describe('MessageChannel', () => {
  it('push then next returns the message', async () => {
    const ch = new MessageChannel();
    ch.push('hello');
    const iter = ch[Symbol.asyncIterator]();
    const result = await iter.next();
    expect(result.done).toBe(false);
    expect(result.value).toEqual({
      type: 'user',
      message: { role: 'user', content: 'hello' },
    });
  });

  it('next then push resolves the waiting promise', async () => {
    const ch = new MessageChannel();
    const iter = ch[Symbol.asyncIterator]();
    const promise = iter.next();
    ch.push('delayed');
    const result = await promise;
    expect(result.done).toBe(false);
    expect(result.value.message.content).toBe('delayed');
  });

  it('close causes next to return done', async () => {
    const ch = new MessageChannel();
    ch.close();
    const iter = ch[Symbol.asyncIterator]();
    const result = await iter.next();
    expect(result.done).toBe(true);
  });

  it('close resolves a waiting next with done', async () => {
    const ch = new MessageChannel();
    const iter = ch[Symbol.asyncIterator]();
    const promise = iter.next();
    ch.close();
    const result = await promise;
    expect(result.done).toBe(true);
  });

  it('multiple messages are delivered in order', async () => {
    const ch = new MessageChannel();
    ch.push('first');
    ch.push('second');
    ch.push('third');
    const iter = ch[Symbol.asyncIterator]();
    const r1 = await iter.next();
    const r2 = await iter.next();
    const r3 = await iter.next();
    expect(r1.value.message.content).toBe('first');
    expect(r2.value.message.content).toBe('second');
    expect(r3.value.message.content).toBe('third');
  });

  it('push after close throws', () => {
    const ch = new MessageChannel();
    ch.close();
    expect(() => ch.push('nope')).toThrow('Channel is closed');
  });

  it('isClosed reflects state', () => {
    const ch = new MessageChannel();
    expect(ch.isClosed).toBe(false);
    ch.close();
    expect(ch.isClosed).toBe(true);
  });

  it('works with for-await-of', async () => {
    const ch = new MessageChannel();
    ch.push('a');
    ch.push('b');
    ch.close();

    const messages: string[] = [];
    for await (const msg of ch) {
      messages.push(msg.message.content);
    }
    expect(messages).toEqual(['a', 'b']);
  });
});
