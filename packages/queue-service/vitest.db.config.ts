import { defineConfig } from 'vitest/config';

// Integration tests against a real local database (supabase start). Run by the
// CI database job with DATABASE_URL set; skipped otherwise.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.db.test.ts'],
    testTimeout: 30000,
    fileParallelism: false,
  },
});
