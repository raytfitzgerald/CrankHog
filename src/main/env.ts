import { app } from 'electron'
import { join } from 'node:path'
import { migrateFromFreeGaz } from './user-data'

/** Process-wide flags, resolved once at startup. */
export const env = {
  /** True when launched by the Playwright E2E suite. Enables test hooks. */
  isTest: process.env.CRANKHOG_TEST === '1',
  /** Start with simulated devices instead of Bluetooth. */
  sim: process.env.CRANKHOG_SIM === '1',
  /** Time-warp factor for simulated rides (tests use 20-30x). */
  warp: Math.max(1, Number(process.env.CRANKHOG_WARP ?? '1') || 1),
  /** Dev server URL injected by electron-vite in `npm run dev`. */
  devServerUrl: process.env.ELECTRON_RENDERER_URL,
}

/**
 * Dev and test runs get their own userData so they never touch real rides.
 * IndexedDB is keyed by origin + userData, so this separation is load-bearing.
 * E2E runs (CRANKHOG_TEST with a CRANKHOG_USER_DATA profile) get a private Documents too.
 * A packaged launch also carries any FreeGaz profile over first (user-data.ts).
 */
export function configureUserData(): void {
  const override = process.env.CRANKHOG_USER_DATA
  if (override) {
    app.setPath('userData', override)
    // Test runs also get their own Documents, so FIT exports and Zwift
    // workout files land in the throwaway profile, never the rider's folders.
    if (env.isTest) app.setPath('documents', join(override, 'Documents'))
    return
  }
  if (!app.isPackaged) {
    app.setPath('userData', join(app.getPath('appData'), 'CrankHog-dev'))
    return
  }
  // A real install: carry a FreeGaz profile over before anything reads it.
  const outcome = migrateFromFreeGaz({ userData: app.getPath('userData'), documents: app.getPath('documents') })
  for (const [what, result] of Object.entries(outcome)) {
    if (result.moved) console.log(`[user-data] moved ${what}: ${result.from} → ${result.to}`)
    else if (result.reason === 'failed') console.error(`[user-data] could not move ${what}: ${result.error}`)
    else if (result.reason === 'both-exist') console.warn(`[user-data] both FreeGaz and CrankHog ${what} folders exist; using CrankHog and leaving FreeGaz alone`)
  }
}
