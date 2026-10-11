import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

/**
 * The App Store screenshots, captured from the production web build in demo
 * mode — the same way docs/IOS.md says they were taken by hand. Two sizes,
 * both at 3x: 440x956 points for the 6.9" iPhone and 428x926 for the 6.5".
 *
 * Demo mode stands in for a trainer (?sim=1), so nothing here is a real ride.
 */

const SIZES = [
  { dir: 'docs/app-store', width: 440, height: 956 },
  { dir: 'docs/app-store/6.5-inch', width: 428, height: 926 },
] as const

async function tab(page: Page, name: string): Promise<void> {
  await page.getByRole('link', { name, exact: true }).first().click()
}

for (const size of SIZES) {
  test.describe(`${size.width}x${size.height} at 3x`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 3 })

    test('the five store screens', async ({ page }) => {
      const out = join(__dirname, '../..', size.dir)
      mkdirSync(out, { recursive: true })
      const shot = async (name: string) => {
        await page.waitForTimeout(500)
        await page.screenshot({ path: join(out, `${name}.png`) })
      }

      await page.goto('/?sim=1')
      await expect(page.getByRole('navigation').first()).toBeVisible()
      // Demo mode connects a simulated trainer and strap; wait for watts, not
      // for the Sim chip, whose capitals are CSS rather than text.
      await expect(page.getByTestId('status-trainer').first()).toContainText(/\d/, { timeout: 30_000 })

      await tab(page, 'Home')
      await shot('1-home')

      await tab(page, 'Ride')
      const change = page.getByTestId('change-ride')
      if (await change.isVisible().catch(() => false)) await change.click()
      await expect(page.getByRole('heading', { name: 'What are we riding?' })).toBeVisible()
      await shot('2-ride')

      await tab(page, 'Workouts')
      await expect(page.getByTestId('workout-card').first()).toBeVisible()
      await shot('3-workouts')

      // Into a workout: the ride screen, then the big tiles further down it.
      await page.getByTestId('workout-card').filter({ hasText: 'Race Openers' }).first().click()
      await page.getByTestId('ride-workout').click()
      await expect(page.getByTestId('interval-remaining')).toBeVisible()
      // Real time here: the web build has no time warp, so this is 40 seconds
      // of actual pedalling before the numbers are worth photographing.
      await page.waitForTimeout(40_000)
      // Starting the workout leaves the page scrolled; the first shot is the
      // top of the ride screen, the second is the tiles below it.
      await page.mouse.wheel(0, -3000)
      await shot('4-workout')

      await page.mouse.wheel(0, 1400)
      await shot('5-workout-tiles')
    })
  })
}
