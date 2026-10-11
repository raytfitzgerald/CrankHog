import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { launchApp, type Launched } from '../e2e/launch'

/**
 * Captures the README tour into docs/screenshots/. Not part of `npm run e2e`;
 * run it with `npm run screenshots` when the interface has moved on.
 *
 * Everything here rides the simulator in a throwaway profile, so the pictures
 * never contain a real ride. Units are left at the app's own default, because
 * the README should show what a new rider actually gets.
 */

const OUT = join(__dirname, '../../docs/screenshots')
const WIDTH = 1600
const HEIGHT = 1000

let ctx: Launched

/** Achievement and personal-best toasts stack over the bottom-right corner; send them away first. */
async function clearToasts(page: Page): Promise<void> {
  const dismiss = page.getByRole('button', { name: 'Dismiss' })
  for (let left = await dismiss.count(); left > 0; left = await dismiss.count()) {
    await dismiss.first().click()
    await expect(dismiss).toHaveCount(left - 1)
  }
}

async function shot(page: Page, name: string, opts: { fullPage?: boolean } = {}): Promise<void> {
  await clearToasts(page)
  // Let the velodrome, charts and caricatures settle before the shutter.
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: opts.fullPage ?? false })
}

const nav = (page: Page, name: string) => page.getByRole('link', { name, exact: true }).click()

/** Back to the ride-type picker, wherever the last ride left the tab. */
async function ridePicker(page: Page): Promise<void> {
  await nav(page, 'Ride')
  const change = page.getByTestId('change-ride')
  if (await change.isVisible().catch(() => false)) await change.click()
  await expect(page.getByTestId('ride-launcher').getByRole('heading', { name: 'What are we riding?' })).toBeVisible()
}

/** A 20-minute ride at 30x warp: about 40 seconds of wall clock, and real history afterwards. */
async function rideForTime(page: Page): Promise<void> {
  await ridePicker(page)
  await page.getByTestId('ride-choice-time').click()
  await page.getByRole('button', { name: '20 min', exact: true }).click()
  await page.getByTestId('start-time-ride').click()
  await expect(page.getByTestId('ride-button')).toHaveAttribute('data-recording', 'true')
  await expect(page.getByTestId('finish-ride')).toBeEnabled()
  await page.waitForTimeout(42_000)
  await page.getByTestId('finish-ride').click()
  await page.getByTestId('confirm-finish').click()
  await expect(page.getByTestId('saved-ride')).toBeVisible({ timeout: 20_000 })
}

/**
 * Simulated rides are flagged, and fitness.ts keeps flagged rides out of the
 * week, the streak and the PMC — rightly, because they are not real efforts.
 * The tour still needs a Home with something on it, so the throwaway profile's
 * rides drop the flag here. It touches nothing outside this profile, and the
 * numbers on Home are then the app's own, computed from rides it really rode.
 */
async function countProfileRidesAsReal(page: Page): Promise<void> {
  const changed = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('freegaz')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const database = open.result
          const tx = database.transaction('rides', 'readwrite')
          const store = tx.objectStore('rides')
          const all = store.getAll()
          let n = 0
          all.onsuccess = () => {
            for (const ride of all.result as { simulated?: boolean }[]) {
              if (!ride.simulated) continue
              store.put({ ...ride, simulated: false })
              n += 1
            }
          }
          tx.oncomplete = () => {
            database.close()
            resolve(n)
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
  expect(changed).toBeGreaterThan(0)
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
}

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true })
  ctx = await launchApp({ sim: true, warp: 30, units: null, env: { CRANKHOG_SHOW: '1' } })
  await ctx.app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0]
    win?.setContentSize(size.w, size.h)
  }, { w: WIDTH, h: HEIGHT })
  // The coach talks over a ride; these runs are silent.
  await ctx.page.evaluate(() => window.speechSynthesis?.cancel())
  await nav(ctx.page, 'Devices')
  await expect(ctx.page.getByTestId('device-trainer-name')).toHaveText('SIM KICKR 0001')
})

test.afterAll(async () => {
  await ctx?.close()
})

test('an athlete with a history, so Home has something to show', async () => {
  const { page } = ctx
  await nav(page, 'Settings')
  await page.getByRole('tab', { name: 'Athlete & FTP' }).click()
  const weight = page.getByRole('spinbutton', { name: 'Weight' })
  await weight.fill('168')
  await weight.press('Tab')
  const lthr = page.getByRole('spinbutton', { name: 'Threshold HR' })
  await lthr.fill('165')
  await lthr.press('Enter')
  await page.getByTestId('ftp-input').fill('243')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  // Two rides: enough for a streak, a week's TSS and the first achievements.
  await rideForTime(page)
  await rideForTime(page)
  await countProfileRidesAsReal(page)
})

test('home', async () => {
  const { page } = ctx
  await nav(page, 'Home')
  await shot(page, 'home')
})

test('ride picker and ride for time', async () => {
  const { page } = ctx
  await ridePicker(page)
  await shot(page, 'ride-picker')
  await page.getByTestId('ride-choice-time').click()
  await expect(page.getByTestId('ride-launcher').getByRole('heading', { name: 'Ride for time' })).toBeVisible()
  await shot(page, 'ride-for-time')
})

test('a workout mid-ride, and the ride-along', async () => {
  const { page } = ctx
  await nav(page, 'Workouts')
  await page.getByPlaceholder('Search workouts').fill('Race Openers')
  await page.getByTestId('workout-card').filter({ hasText: 'Race Openers' }).first().click()
  await page.getByTestId('ride-workout').click()
  await expect(page.getByTestId('interval-remaining')).toBeVisible()
  // The ride-along is its own strip in the README, cropped to the coach and
  // whatever he is saying, so take it while the opening line is still up.
  const along = page.getByTestId('ride-along')
  await expect(along).toBeVisible()
  await expect(page.getByTestId('ride-along-bubble')).not.toHaveText(/^\s*$/, { timeout: 20_000 })
  await clearToasts(page)
  await page.waitForTimeout(400)
  await along.screenshot({ path: join(OUT, 'ride-along.png') })
  // Then ride on a few more minutes, so the chart has a trace to show and the
  // tiles have numbers rather than dashes.
  await expect(page.getByTestId('actual-power-line')).toHaveAttribute('d', /L/, { timeout: 20_000 })
  await page.waitForTimeout(25_000)
  await shot(page, 'workout')
  await page.getByTestId('finish-ride').click()
  await page.getByRole('button', { name: 'Discard' }).click()
})

test('the workouts library, the training plan, and the rude one', async () => {
  const { page } = ctx
  await nav(page, 'Workouts')
  await page.getByPlaceholder('Search workouts').fill('')
  await expect(page.getByTestId('workout-card').nth(27)).toBeVisible()
  await shot(page, 'workouts')
  await page.getByPlaceholder('Search workouts').fill('The Bird')
  await page.getByTestId('workout-card').filter({ hasText: 'The Bird' }).first().click()
  await shot(page, 'the-bird', { fullPage: true })
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: /Training plan/ }).click()
  await shot(page, 'training-plan')
})

test('the builder', async () => {
  const { page } = ctx
  await nav(page, 'Builder')
  await shot(page, 'builder')
})

test('a route ride', async () => {
  const { page } = ctx
  await nav(page, 'Routes')
  await page.getByTestId('route-card').filter({ hasText: 'CrankHog Six Percent' }).click()
  await page.getByTestId('ride-route-reactive').click()
  await expect(page.getByTestId('route-view')).toBeVisible()
  await expect.poll(async () => Number(await page.getByTestId('route-distance-value').textContent()), { timeout: 20_000 }).toBeGreaterThan(0.2)
  await shot(page, 'route')
  await page.getByTestId('finish-ride').click()
  await page.getByRole('button', { name: 'Discard' }).click()
})

test('coach settings', async () => {
  const { page } = ctx
  await nav(page, 'Settings')
  await page.getByRole('tab', { name: 'Coach' }).click()
  await shot(page, 'coach')
})

test('home in the light theme, last so the rest stay dark', async () => {
  const { page } = ctx
  await nav(page, 'Settings')
  await page.getByRole('tab', { name: 'Appearance' }).click()
  await page.getByRole('radio', { name: 'Light' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await nav(page, 'Home')
  await shot(page, 'home-light')
})
