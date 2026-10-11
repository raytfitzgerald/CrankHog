import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface LaunchOptions {
  sim?: boolean
  warp?: number
  env?: Record<string, string>
  /** Reuse a profile (e.g. to relaunch after a kill); it is then left in place on close. */
  userData?: string
  /**
   * Units for the profile, pinned before the app reads them. Defaults to metric
   * because the specs are written in km, m and km/h; pass null to inherit the
   * app's own default for a new install, which is what a real rider gets.
   */
  units?: 'metric' | 'imperial' | null
}

export interface Launched {
  app: ElectronApplication
  page: Page
  userData: string
  close(): Promise<void>
}

/**
 * Writes the profile's units before the app starts, so a spec says which units
 * it reads rather than inheriting whatever a new install happens to default to.
 * That default went imperial in 0.6.0 and silently rewrote every distance the
 * specs assert on. A profile that already has settings keeps them, so a
 * relaunch sees exactly what the first run left behind.
 */
function seedUnits(userData: string, units: 'metric' | 'imperial' | null): void {
  if (units === null) return
  const file = join(userData, 'settings.json')
  if (existsSync(file)) return
  const imperial = units === 'imperial'
  mkdirSync(userData, { recursive: true })
  const seed = { version: 1, units, speedUnit: imperial ? 'mph' : 'kmh', weightUnit: imperial ? 'lb' : 'kg' }
  writeFileSync(file, JSON.stringify(seed, null, 2), 'utf8')
}

/** Launches the built app (run `npm run build` first) with an isolated profile. */
export async function launchApp(opts: LaunchOptions = {}): Promise<Launched> {
  const owned = opts.userData === undefined
  const userData = opts.userData ?? mkdtempSync(join(tmpdir(), 'crankhog-e2e-'))
  seedUnits(userData, opts.units === undefined ? 'metric' : opts.units)
  // Launch the project root so Electron reads package.json (name, version,
  // "main": out/main/index.js) exactly like the packaged app does.
  const args = [join(__dirname, '../..')]
  if (process.platform === 'linux') args.unshift('--no-sandbox')

  const app = await electron.launch({
    args,
    // Playwright emulates a light prefers-color-scheme by default; the app's
    // theme follows Electron's nativeTheme, so let the real value through.
    colorScheme: null,
    env: {
      ...(process.env as Record<string, string>),
      CRANKHOG_TEST: '1',
      CRANKHOG_USER_DATA: userData,
      CRANKHOG_SIM: opts.sim === false ? '0' : '1',
      CRANKHOG_WARP: String(opts.warp ?? 1),
      ...opts.env,
    },
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  return {
    app,
    page,
    userData,
    async close() {
      await app.close().catch(() => undefined)
      if (owned) rmSync(userData, { recursive: true, force: true })
    },
  }
}

/** Opens the Ride tab on a free ride: through the ride-type picker, or straight there if it's already chosen. */
export async function openFreeRide(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Ride', exact: true }).click()
  const pick = page.getByTestId('ride-choice-free')
  await expect(pick.or(page.getByRole('heading', { name: 'Just ride' }))).toBeVisible()
  if (await pick.isVisible()) await pick.click()
  await expect(page.getByRole('heading', { name: 'Just ride' })).toBeVisible()
}
