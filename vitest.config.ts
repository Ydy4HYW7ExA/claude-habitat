import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/mcp/main.ts',
        'src/mcp/server.ts',
        'src/domain/hook/types.ts',
        'src/domain/plugin/types.ts',
        'src/domain/command/types.ts',
        'src/domain/skill/types.ts',
        'src/domain/workflow/types.ts',
        'src/domain/rule/types.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
      reporter: ['text', 'json', 'html'],
    },
    testTimeout: 10000,
  },
});
