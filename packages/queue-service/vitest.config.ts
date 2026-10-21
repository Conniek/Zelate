import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.db.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/testing.ts',
        'src/harness.ts',
        'src/index.ts',
        'src/ports.ts',
        'src/postgres.ts',
      ],
      reporter: ['text-summary', 'text'],
      thresholds: { lines: 95 },
    },
  },
});
