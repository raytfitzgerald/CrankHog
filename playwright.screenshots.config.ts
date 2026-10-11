import { defineConfig, devices } from '@playwright/test'

// The documentation screenshots. Separate from playwright.config.ts so
// `npm run e2e` never rewrites docs/, and so these can take their time: some
// of them ride a simulated workout first.
//
//   readme    — the Electron app, into docs/screenshots
//   app-store — the production web build in demo mode, into docs/app-store
export default defineConfig({
  testDir: 'tests/screenshots',
  timeout: 300_000,
  expect: { timeout: 20_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  projects: [
    { name: 'readme', testMatch: /capture\.spec\.ts/ },
    {
      name: 'app-store',
      testMatch: /app-store\.spec\.ts/,
      // Appearance follows the system, and a headless browser says light.
      // The store shots have always been dark, which is the brand.
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5198', colorScheme: 'dark' },
    },
  ],
  webServer: {
    command: 'npm run build:web && npm run preview:web',
    url: 'http://localhost:5198',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
