import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { WebSocket } from 'ws'
import { LIVE_CHECK_APP_ID } from '../../src/main/group-ride/live-check'
import { launchApp, type Launched } from './launch'

// The Mac app on the public OpenBikeNet server, on request only. The app's
// window connects as crankhog with its real version, only watching; the
// stands connect as crankhog-live-check, so the test itself stays out of
// CrankHog's numbers in the server's public stats. Both still show up there:
//
//   CRANKHOG_LIVE_OBN=1 npx playwright test tests/e2e/group-ride-live.spec.ts
//
// With Ride with others switched on and the default server, the app connects
// as soon as a shared track is opened. The ride here runs on simulated
// devices, so it must stay off the public track: the stands check it never
// joins.
test.skip(!process.env.CRANKHOG_LIVE_OBN, 'live check against openbikenet.cloud: set CRANKHOG_LIVE_OBN=1')

const SERVER = 'wss://openbikenet.cloud/v0'
const NAME = 'CrankHog live check'
let ctx: Launched
let userData: string
let stands: WebSocket
const heard: Record<string, unknown>[] = []

test.beforeAll(async () => {
  stands = new WebSocket(SERVER)
  stands.on('message', (raw) => heard.push(JSON.parse(String(raw)) as Record<string, unknown>))
  await new Promise((resolve, reject) => {
    stands.once('open', resolve)
    stands.once('error', reject)
  })
  const version = (JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as { version: string }).version
  stands.send(JSON.stringify({ type: 'hello', app: { id: LIVE_CHECK_APP_ID, version } }))
  stands.send(JSON.stringify({ type: 'subscribe', route: 'velodrome-250', room: 'public' }))

  userData = mkdtempSync(join(tmpdir(), 'crankhog-e2e-'))
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ version: 1, units: 'metric', speedUnit: 'kmh', weightUnit: 'kg', groupRides: { enabled: true, name: NAME } }))
  ctx = await launchApp({ sim: true, userData })
  await ctx.page.getByRole('link', { name: 'Devices' }).click()
  await expect(ctx.page.getByTestId('device-trainer-name')).toHaveText('SIM KICKR 0001')
})

test.afterAll(async () => {
  stands?.close()
  await ctx?.close()
  rmSync(userData, { recursive: true, force: true })
})

test('the app connects to the public server, and keeps a simulated ride off its track', async () => {
  const { page } = ctx
  const shots = process.env.CRANKHOG_E2E_SHOTS
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('tab', { name: /Ride with others/ }).click()
  await expect(page.getByTestId('group-ride-server')).toHaveValue(SERVER)

  await page.getByRole('link', { name: 'Routes' }).click()
  await page.getByTestId('shared-tracks').getByTestId('route-card').filter({ hasText: 'Velodrome 250 m' }).click()
  await expect(page.getByTestId('track-riders-now')).toContainText('Connected', { timeout: 20_000 })
  if (shots) await page.screenshot({ path: join(shots, 'live-dialog.png') })

  await page.getByTestId('ride-route-reactive').click()
  const panel = page.getByTestId('track-riders-panel')
  await expect(panel.getByTestId('track-riders-status')).toContainText('Connected')
  await expect(panel.getByTestId('track-riders-hold')).toContainText('Simulated rides stay off the public server')
  await page.waitForTimeout(5000)
  expect(heard.some((m) => m.type === 'joined' && (m.rider as Record<string, unknown>).name === NAME)).toBe(false)
  if (shots) {
    await panel.scrollIntoViewIfNeeded()
    await panel.locator('..').screenshot({ path: join(shots, 'live-ride.png') })
  }
  await page.getByTestId('finish-ride').click()
  await page.getByTestId('confirm-finish').click()
})
