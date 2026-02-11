import type { HookHandler } from './types.js';
import type { Logger } from '../../logging/logger.js';

export function createBuiltinHooks(logger: Logger): HookHandler[] {
  return [
    {
      id: 'builtin:log-errors',
      event: 'on:error',
      name: 'Error Logger',
      priority: 0,
      handler: (ctx) => {
        if (ctx.error) {
          logger.error(`Hook error: ${ctx.error.message}`);
        }
      },
    },
  ];
}
