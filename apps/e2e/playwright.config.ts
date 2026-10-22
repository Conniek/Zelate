import { defineConfig } from '@playwright/test';
import { localEnv } from './tests/env';

const env = localEnv();

export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5174',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  // Zelaté Pro on 5174 (default base URL), the client app on 5173 (DEV-8).
  webServer: [
    {
      command: 'corepack pnpm --filter @zelate/pro dev',
      cwd: '../..',
      url: 'http://localhost:5174',
      reuseExistingServer: true,
      env: {
        VITE_SUPABASE_URL: env.apiUrl,
        VITE_SUPABASE_ANON_KEY: env.anonKey,
      },
    },
    {
      command: 'corepack pnpm --filter @zelate/client dev',
      cwd: '../..',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      env: {
        VITE_SUPABASE_URL: env.apiUrl,
        VITE_SUPABASE_ANON_KEY: env.anonKey,
      },
    },
  ],
});
