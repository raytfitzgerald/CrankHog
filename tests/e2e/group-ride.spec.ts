import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { WebSocket } from 'ws'
import { StandInServer, type Msg } from '../../src/main/group-ride/stand-in-server'
import { launchApp, type Launched } from './launch'

// Ride with others (beta) against a stand-in OpenBikeNet server on this Mac,
// never the public one. Another app's rider, Anna, is already going round the
// velodrome; CrankHog (simulated devices, which a server on this Mac takes)
// sees her from the route dialog, joins her, and leaves at the finish.
let ctx: Launched
let server: StandInServer
let userData: string
let anna: { ws: WebSocket; heard: Msg[]; timer: NodeJS.Timeout }

test.beforeAll(async () => {
  server = new StandInServer()
  await server.listening
  userData = mkdtempSync(join(tmpdir(), 'crankhog-e2e-'))
  mkdirSync(userData, { recursive: true })
  writeFileSync(
    join(userData, 'settings.json'),
    JSON.stringify({ version: 1, units: 'metric', speedUnit: 'kmh', weightUnit: 'kg', groupRides: { enabled: true, name: 'E2E Hog', sharePower: true, shareHeartRate: false, server: server.url } }),
  )

  // Anna rides another app round the velodrome at 36 km/h.
  const ws = new WebSocket(server.url)
  const heard: Msg[] = []
  ws.on('message', (raw) => heard.push(JSON.parse(String(raw)) as Msg))
  await new Promise((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('error', reject)
  })
  const send = (m: Msg) => ws.send(JSON.stringify(m))
  send({ type: 'hello', app: { id: 'openradlr', version: '0.2.0' } })
  send({ type: 'subscribe', route: 'velodrome-250', room: 'public' })
  let d = 100
  send({ type: 'join', rider: 'u-1', route: 'velodrome-250', room: 'public', name: 'Anna', lap: 0, distance: d, speed: 10, power: 240 })
  const timer = setInterval(() => {
    d = (d + 10) % 250
    send({ type: 'update', riders: [{ rider: 'u-1', lap: 0, distance: d, speed: 10, power: 240 }] })
  }, 1000)
  anna = { ws, heard, timer }

  ctx = await launchApp({ sim: true, warp: 1, userData })
  await ctx.page.getByRole('link', { name: 'Devices' }).click()
  await expect(ctx.page.getByTestId('device-trainer-name')).toHaveText('SIM KICKR 0001')
})

test.afterAll(async () => {
  clearInterval(anna?.timer)
  anna?.ws.close()
  await ctx?.close()
  await server?.stop()
  rmSync(userData, { recursive: true, force: true })
})

const shots = process.env.CRANKHOG_E2E_SHOTS

test('the shared tracks are in the library, marked beta', async () => {
  const { page } = ctx
  await page.getByRole('link', { name: 'Routes' }).click()
  const section = page.getByTestId('shared-tracks')
  await expect(section).toContainText('Shared tracks')
  await expect(section.getByTestId('beta-badge')).toHaveText('Beta')
  await expect(section.getByTestId('route-card')).toHaveCount(3)
  await expect(section.getByTestId('route-card').first()).toContainText('250 m')
  await expect(page.getByTestId('demo-routes').getByTestId('route-card')).toHaveCount(4)
  if (shots) await page.screenshot({ path: join(shots, 'routes.png') })
})

test('the route dialog shows who is on the track before you ride', async () => {
  const { page } = ctx
  await page.getByTestId('shared-tracks').getByTestId('route-card').filter({ hasText: 'Velodrome 250 m' }).click()
  const now = page.getByTestId('track-riders-now')
  await expect(now).toContainText('On the track now')
  await expect(now.getByTestId('beta-badge')).toBeVisible()
  await expect(now.getByTestId('track-riders-list')).toContainText('Anna')
  await expect(now.getByTestId('track-riders-list')).toContainText('openradlr')
  await expect(page.getByTestId('route-laps')).toHaveValue('80') // 20 km
  if (shots) await page.screenshot({ path: join(shots, 'dialog.png') })
})

test('riding the velodrome puts you on the track with the others', async () => {
  const { page } = ctx
  await page.getByTestId('ride-route-reactive').click()
  await expect(page.getByTestId('route-view')).toBeVisible()

  const panel = page.getByTestId('track-riders-panel')
  await expect(panel.getByTestId('beta-badge')).toBeVisible()
  await expect(panel.getByTestId('track-riders-status')).toContainText('Connected')
  await expect(panel.getByTestId('track-rider')).toContainText('Anna')
  await expect(panel.getByTestId('track-rider')).toContainText(/m (ahead|behind)|level/)
  await expect(panel.getByTestId('track-riders-you')).toContainText('E2E Hog')
  await expect(page.getByTestId('route-map').getByTestId('map-other')).toHaveCount(1)

  // Anna's app hears CrankHog join, by its display name, and then move
  await expect.poll(() => anna.heard.find((m) => m.type === 'joined')?.rider as Msg | undefined, { timeout: 15_000 }).toMatchObject({ app: 'crankhog', name: 'E2E Hog' })
  await expect.poll(() => anna.heard.filter((m) => m.type === 'updated').length, { timeout: 15_000 }).toBeGreaterThan(2)
  // ride on long enough to be kept (a few seconds of moving time are thrown away)
  await expect.poll(async () => Number(await page.getByTestId('route-distance-value').textContent()), { timeout: 30_000 }).toBeGreaterThan(0.05)
  const hello = server.hellos.find((h) => (h.app as Msg).id === 'crankhog')!
  expect(hello.app).toMatchObject({ id: 'crankhog', name: 'CrankHog', url: 'https://crankhog.app' })
  if (shots) {
    await page.waitForTimeout(3000)
    await page.screenshot({ path: join(shots, 'ride.png') })
    await panel.scrollIntoViewIfNeeded()
    await panel.locator('..').screenshot({ path: join(shots, 'ride-track.png') })
  }

  await page.getByTestId('finish-ride').click()
  await page.getByTestId('confirm-finish').click()
  await expect(page.getByTestId('saved-ride')).toContainText('Velodrome 250 m', { timeout: 15_000 })
  await expect.poll(() => anna.heard.some((m) => m.type === 'left'), { timeout: 10_000 }).toBe(true)
})

test('Settings has a Ride with others tab, marked beta', async () => {
  const { page } = ctx
  await page.getByRole('link', { name: 'Settings' }).click()
  const tab = page.getByRole('tab', { name: /Ride with others/ })
  await expect(tab.getByTestId('beta-badge')).toBeVisible()
  await tab.click()
  await expect(page.getByTestId('group-ride-name')).toHaveValue('E2E Hog')
  await expect(page.getByTestId('group-ride-server')).toHaveValue(server.url)
  if (shots) await page.screenshot({ path: join(shots, 'settings.png') })
})
