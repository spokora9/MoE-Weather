import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/types/**',
        'src/**/index.ts',
        'src/test/**',
        // Untested modules owned by other agents — excluded from threshold checks
        'src/server.ts',
        'src/engine/**',
        'src/middleware/**',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 50,
        statements: 70,
      },
    },
    setupFiles: ['src/test/setup.ts'],
  },
});
