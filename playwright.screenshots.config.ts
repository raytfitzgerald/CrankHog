import { defineConfig } from '@playwright/test'

// The README tour. Separate from playwright.config.ts so `npm run e2e` never
// rewrites docs/screenshots, and so these can take their time: a couple of the
// shots ride a simulated workout first.
export default defineConfig({
  testDir: 'tests/screenshots',
  timeout: 300_000,
  expect: { timeout: 20_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
})
