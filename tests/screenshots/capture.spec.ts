import { mkdirSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
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
 *
 * The coach chat talks to a fake Ollama server on localhost, as in
 * tests/e2e/coach-actions.spec.ts, so the change card and the plan the coach
 * drafts are the app's own, drawn from a scripted conversation. The plan it
 * builds is what fills the calendar, Home's countdown and the Training plan tab.
 */

// Each picture builds on the ones before it (the rides, then the plan, then the
// calendar it fills), so one failure stops the run rather than shooting a
// fresh, empty app with the rest.
test.describe.configure({ mode: 'serial' })

const OUT = join(__dirname, '../../docs/screenshots')
const WIDTH = 1600
const HEIGHT = 1000

let ctx: Launched
let server: Server
let aiHost = ''
/** How many chat turns the fake coach has answered. */
let chats = 0

const pad = (n: number) => String(n).padStart(2, '0')
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const ahead = (days: number) => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}
/** Days from today to the next Monday (never today): the plan's first day. */
const toMonday = ((8 - new Date().getDay()) % 7) || 7
const WEEKS = 12
/** A plan day: week 1 is next week, weekday 0 is Monday. */
const day = (week: number, weekday: number) => key(ahead(toMonday + 7 * (week - 1) + weekday))
/** Race day: the last week's Sunday. */
const RACE = ahead(toMonday + 7 * (WEEKS - 1) + 6)

// --- The fake coach ---------------------------------------------------------

const tool = (name: string, input: unknown) => `\n\n\`\`\`crankhog-tool\n${JSON.stringify({ tool: name, input })}\n\`\`\``

/** The data the app sent with the rider's latest message. */
function dataOf(user: string): { calendar: { ref: string; name: string; date: string; sport: string }[] } {
  return JSON.parse(/My training data \(JSON\):\n(.*)\n/.exec(user)![1]!) as { calendar: { ref: string; name: string; date: string; sport: string }[] }
}

const BRIEF = {
  name: 'Lakeside Olympic',
  race: { name: 'Lakeside Olympic', date: key(RACE), kind: 'Olympic-distance triathlon (1.5 km swim, 40 km bike, 10 km run)' },
  startDate: day(1, 0),
  sports: ['swim', 'bike', 'run'],
  hoursPerWeek: { start: 6, peak: 9 },
  days: [
    { weekday: 1, maxMinutes: 75 },
    { weekday: 2, maxMinutes: 60, note: 'pool before work' },
    { weekday: 3, maxMinutes: 60 },
    { weekday: 4, maxMinutes: 45, note: 'pool before work' },
    { weekday: 5, maxMinutes: 180 },
    { weekday: 6, maxMinutes: 120 },
  ],
  longRideDay: 5,
  longRunDay: 6,
  athlete: 'Rides four hours a week, runs about 15 miles, swims once in a 25-yard pool. Left calf flares up when run volume jumps.',
}

/** What the coach says, by what the rider asked. */
function chatReply(user: string): string {
  const q = user.slice(user.lastIndexOf('Question: ') + 'Question: '.length)
  if (q.startsWith('Build me a plan'))
    return 'An Olympic, recruit? Outstanding. Before I draft a single session, you answer me these:\n1. How many hours a week now, and at most?\n2. Which days, and how long on each?\n3. Where do you swim?\n4. Anything hurt?'
  if (q.startsWith('Six hours')) return `Calf noted. Your run volume will climb like a sensible person's. Drafting your orders now.${tool('draft_plan', BRIEF)}`
  if (q.startsWith('Work is eating')) {
    const cal = dataOf(user).calendar
    // calendar dates come with their weekday ("2026-11-24 Tue"), and a bike session's sport is ride
    const at = (date: string, sport: string) => cal.find((e) => e.date.startsWith(date) && e.sport === sport)!.ref
    return `I've heard better excuses from a flat tyre. Fine. Tuesday becomes a spin, the swim moves up a day, and Friday is a travel day. Press Apply before I change my mind.${tool('propose_changes', {
      summary: 'Lighter work week: Tuesday easy, Friday off',
      actions: [
        { type: 'replace', ref: at(day(1, 1), 'ride'), sport: 'bike', name: 'Easy spin', steps: '- 45m 60%', why: 'Long days at work: keep the legs moving, skip the intensity' },
        { type: 'move', ref: at(day(1, 4), 'swim'), to: day(1, 3), why: 'Swim before Thursday’s run instead' },
        { type: 'days_off', kind: 'travel', from: day(1, 4), to: day(1, 4), note: 'Work trip', why: 'Nothing on a travel day' },
      ],
    })}`
  }
  return 'Noted. Now get on the bike.'
}

type Phase = 'base' | 'build' | 'peak' | 'recovery' | 'taper'
const PHASES: Phase[] = ['base', 'base', 'base', 'recovery', 'build', 'build', 'build', 'recovery', 'peak', 'peak', 'taper', 'taper']
const HOURS = [6, 6.5, 7, 4.5, 7.5, 8, 8.5, 5.5, 9, 8.5, 6, 3.5]
const FOCUS: Record<Phase, string> = {
  base: 'Aerobic base in all three, swim technique',
  build: 'Threshold work on the bike and run',
  peak: 'Race pace, and bricks',
  recovery: 'Easy all week: absorb the block',
  taper: 'Sharp and rested for race day',
}
const KEY: Record<Phase, string[]> = {
  base: ['Sweet spot 3x10', 'CSS 8x100', 'Long ride'],
  build: ['Threshold 3x12', 'Run 5x5 at threshold', 'Long ride with tempo'],
  peak: ['Race pace 2x20', 'Brick', 'Race-pace 3x400'],
  recovery: ['Endurance ride', 'Easy run'],
  taper: ['Openers', 'Run openers'],
}

function outline(): unknown {
  return {
    notes: 'Three base weeks, a build block and a peak block, each followed by an easy week, then a two-week taper into race day. Run volume builds slowly for the calf.',
    weeks: PHASES.map((phase, i) => {
      const h = HOURS[i]!
      return { week: i + 1, phase, focus: FOCUS[phase], hours: { swim: +(h * 0.2).toFixed(1), bike: +(h * 0.52).toFixed(1), run: +(h * 0.28).toFixed(1), other: 0 }, keySessions: KEY[phase] }
    }),
  }
}

const session = (week: number, weekday: number, sport: string, name: string, steps: string, notes: string | null = null) => ({ week, weekday, sport, name, steps, minutes: null, effort: null, notes })

const BIKE: Record<Phase, [string, string, string | null]> = {
  base: ['Sweet spot 3x10', 'Warm-up\n- 10m ramp 50-75%\n\nMain set 3x\n- 10m 88-94%\n- 5m 55%\n\nCool-down\n- 10m 50%', 'Hard enough to talk in short sentences, no more.'],
  build: ['Threshold 3x12', 'Warm-up\n- 12m ramp 50-80%\n\nMain set 3x\n- 12m 95-100%\n- 4m 55%\n\nCool-down\n- 8m 50%', null],
  peak: ['Race pace 2x20', 'Warm-up\n- 10m ramp 50-80%\n\nMain set 2x\n- 20m 85-90%\n- 5m 55%\n\nCool-down\n- 10m 50%', 'Olympic race effort: what you could hold for 70 minutes.'],
  recovery: ['Easy spin', '- 45m 60%', null],
  taper: ['Openers', 'Warm-up\n- 10m ramp 50-75%\n\nMain set 4x\n- 1m 110%\n- 2m 55%\n\nCool-down\n- 10m 50%', null],
}
const SWIM: Record<Phase, [string, string]> = {
  base: ['CSS 8x100', 'Warm-up\n- 300y easy\n\nDrills 4x\n- 50y drill\n- 15s rest\n\nMain set 8x\n- 100y 100% Pace\n- 15s rest\n\nCool-down\n- 200y easy'],
  build: ['CSS 10x100', 'Warm-up\n- 300y easy\n\nMain set 10x\n- 100y 100% Pace\n- 15s rest\n\nCool-down\n- 200y easy'],
  peak: ['Race-pace 3x400', 'Warm-up\n- 400y easy\n\nMain set 3x\n- 400y 97% Pace\n- 30s rest\n\nCool-down\n- 200y easy'],
  recovery: ['Easy swim', '- 1200y easy'],
  taper: ['Swim openers', 'Warm-up\n- 300y easy\n\nMain set 6x\n- 50y 105% Pace\n- 20s rest\n\nCool-down\n- 200y easy'],
}
const RUN: Record<Phase, [string, string]> = {
  base: ['Tempo run', 'Warm-up\n- 15m Z2 HR\n\nMain set\n- 20m Z3 HR\n\nCool-down\n- 10m Z1 HR'],
  build: ['Threshold 5x5', 'Warm-up\n- 15m Z2 HR\n\nMain set 5x\n- 5m 100% Pace\n- 90s Z1 HR\n\nCool-down\n- 10m Z1 HR'],
  peak: ['10k pace 3x1mi', 'Warm-up\n- 15m Z2 HR\n\nMain set 3x\n- 1mi 98% Pace\n- 2m Z1 HR\n\nCool-down\n- 10m Z1 HR'],
  recovery: ['Easy run', '- 35m Z2 HR'],
  taper: ['Run openers', 'Warm-up\n- 15m Z2 HR\n\nMain set 4x\n- 30s Z5 HR\n- 90s Z1 HR\n\nCool-down\n- 10m Z1 HR'],
}
const LONG_RIDE = [120, 135, 150, 90, 150, 165, 180, 90, 180, 165, 90, 30]
const LONG_RUN = [60, 65, 70, 45, 70, 75, 80, 45, 85, 80, 50, 0]

/** Every session of weeks a to b. */
function sessions(a: number, b: number): unknown {
  const items = []
  for (let week = a; week <= b; week += 1) {
    const phase = PHASES[week - 1]!
    const [bike, bikeSteps, bikeNotes] = BIKE[phase]
    items.push(session(week, 1, 'bike', bike, bikeSteps, bikeNotes))
    items.push(session(week, 2, 'swim', ...SWIM[phase]))
    items.push(session(week, 3, 'run', ...RUN[phase]))
    if (week < WEEKS) items.push(session(week, 4, 'swim', 'Technique swim', 'Warm-up\n- 200y easy\n\nDrills 6x\n- 50y drill\n- 20s rest\n\nMain set\n- 800y easy pull\n\nCool-down\n- 200y easy'))
    const long = LONG_RIDE[week - 1]!
    if (week === WEEKS) items.push(session(week, 5, 'bike', 'Shakeout spin', '- 20m 60%\n\n3x\n- 30s 100%\n- 90s 55%', 'Rack the bike after this.'))
    else if (phase === 'peak') items.push(session(week, 5, 'bike', 'Brick ride', `Warm-up\n- 15m ramp 50-70%\n\nMain set\n- ${long - 45}m 70%\n- 20m 85-90%\n\nCool-down\n- 10m 55%`, 'Straight into a 20-minute run off the bike.'))
    else items.push(session(week, 5, 'bike', phase === 'build' ? 'Long ride with tempo' : 'Long ride', phase === 'build' ? `Warm-up\n- 15m ramp 50-70%\n\nMain set\n- ${long - 55}m 68%\n- 30m 80%\n\nCool-down\n- 10m 55%` : `- ${long}m 65%`))
    const run = LONG_RUN[week - 1]!
    if (run > 0) items.push(session(week, 6, 'run', 'Long run', `- ${run}m Z2 HR`, week === 1 ? 'Easy. If the calf talks, walk a minute.' : null))
  }
  return { items }
}

function startFakeCoach(): Promise<string> {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (c: Buffer) => (body += c.toString()))
    req.on('end', () => {
      if (req.url === '/api/tags') {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ models: [{ name: 'fake-coach' }] }))
        return
      }
      if (req.url !== '/api/chat') {
        res.statusCode = 404
        res.end('{}')
        return
      }
      const j = JSON.parse(body) as { model: string; format?: unknown; messages: { role: string; content: string }[] }
      const system = j.messages[0]!.content
      const user = j.messages.at(-1)!.content
      let reply: string
      try {
        if (j.format) {
          // the planner: the outline, then the sessions a few weeks at a time
          const weeks = /Write every session of weeks? (\d+)(?: to (\d+))?/.exec(user)
          const value = system.includes("Outline the rider's training plan week by week") ? outline() : sessions(Number(weeks![1]), Number(weeks![2] ?? weeks![1]))
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ model: j.model, created_at: new Date().toISOString(), message: { role: 'assistant', content: JSON.stringify(value) }, done: true, done_reason: 'stop' }))
          return
        }
        reply = chatReply(user)
      } catch (err) {
        // a script that no longer fits the app's data fails its test, not the worker
        console.error('fake coach:', err)
        res.statusCode = 500
        res.end(JSON.stringify({ error: String(err) }))
        return
      }
      chats += 1
      res.setHeader('content-type', 'application/x-ndjson')
      for (const part of reply.match(/[\s\S]{1,12}/g)!) res.write(`${JSON.stringify({ model: j.model, created_at: '', message: { role: 'assistant', content: part }, done: false })}\n`)
      res.end(`${JSON.stringify({ model: j.model, created_at: '', message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop' })}\n`)
    })
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)))
}

// --- Helpers ----------------------------------------------------------------

/** Achievement and personal-best toasts stack over the bottom-right corner; send them away first. */
async function clearToasts(page: Page): Promise<void> {
  // the close buttons, not the coach card's own Dismiss, which turns the proposal down
  const dismiss = page.locator('button[aria-label="Dismiss"]')
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

/** Sends the coach a message and waits for the whole answer. */
async function ask(page: Page, text: string): Promise<void> {
  const before = chats
  await page.getByLabel('Message the coach').fill(text)
  await page.getByRole('button', { name: 'Send' }).click()
  await expect.poll(() => chats).toBe(before + 1)
  await expect(page.getByRole('button', { name: 'Stop' })).toHaveCount(0)
}

interface Logged {
  sport: 'Ride' | 'Run' | 'Swim' | 'Other'
  label: string
  time: string
  distance?: string
  effort: 'Easy' | 'Moderate' | 'Hard'
}

/** Logs a finished session on a past day from the calendar's day menu. */
async function logActivity(page: Page, date: string, a: Logged): Promise<void> {
  const cal = page.getByTestId('ride-calendar')
  await cal.locator(`[data-date="${date}"] [data-testid="calendar-day-menu"]`).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: 'Log an activity' }).click()
  await dialog.getByRole('radio', { name: a.sport, exact: true }).click()
  await page.getByTestId('log-label').fill(a.label)
  await page.getByTestId('log-time').fill(a.time)
  if (a.distance) await page.getByTestId('log-distance').fill(a.distance)
  await dialog.getByRole('radio', { name: a.effort, exact: true }).click()
  await page.getByTestId('day-log-add').click()
  await expect(cal.locator(`[data-date="${date}"] [data-testid="calendar-activity"]`)).toContainText(a.label)
}

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true })
  aiHost = await startFakeCoach()
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
  await new Promise((resolve) => server?.close(resolve))
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
  // threshold paces, so planned runs and swims get a time and a load
  const run = page.getByLabel('Threshold run pace')
  await run.fill('7:40')
  await run.press('Tab')
  const swim = page.getByLabel('Swim threshold pace')
  await swim.fill('1:45')
  await swim.press('Tab')

  // Two rides: enough for a streak, a week's TSS and the first achievements.
  await rideForTime(page)
  await rideForTime(page)
  await countProfileRidesAsReal(page)
})

test('the coach builds a triathlon plan in the chat', async () => {
  const { page } = ctx
  await page.evaluate((h) => window.crankhog.invoke('ai.configure', { provider: 'ollama', model: 'fake-coach', ollamaHost: h }), aiHost)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Coach', exact: true }).click()
  await expect(page.getByTestId('chat-persona')).toBeVisible()
  const race = RACE.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  await ask(page, `Build me a plan for the Lakeside Olympic triathlon on ${race}.`)
  await ask(page, 'Six hours now, nine at most. Tuesday 75 minutes, Wednesday and Thursday an hour, Friday 45, Saturday three hours, Sunday two. 25-yard pool before work. My left calf gets cranky if I run too much.')
  const plan = page.getByTestId('coach-plan').last()
  await expect(plan).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await expect(plan.getByTestId('coach-plan-week')).toHaveCount(WEEKS)
  await plan.getByTestId('coach-plan-week').first().locator('summary').first().click()
  await plan.evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await shot(page, 'coach-plan')

  await plan.getByTestId('coach-plan-accept').click()
  await expect(plan).toHaveAttribute('data-state', 'accepted')
})

test('the coach proposes changes as a card', async () => {
  const { page } = ctx
  await ask(page, 'Work is eating me alive next week. Tuesday’s intervals aren’t happening, and I’m away on Friday.')
  const card = page.getByTestId('coach-changes').last()
  await expect(card.getByTestId('coach-change-line')).toHaveCount(3)
  await card.evaluate((el) => el.scrollIntoView({ block: 'end' }))
  await shot(page, 'coach-chat')
  await card.getByTestId('coach-change-apply').click()
  await expect(card.getByTestId('coach-change-status')).toHaveText('Applied')
})

test('the calendar, with the plan on it', async () => {
  const { page } = ctx
  await nav(page, 'Calendar')
  const cal = page.getByTestId('ride-calendar')
  await expect(cal).toBeVisible()
  // a run and a squash game this week, so Home's week has more than rides in it
  await logActivity(page, key(ahead(-2)), { sport: 'Run', label: 'Easy run', time: '0:40', distance: '4.5', effort: 'Easy' })
  await logActivity(page, key(ahead(-1)), { sport: 'Other', label: 'Squash', time: '1:00', effort: 'Moderate' })
  // A month's rows are taller than the window, so the picture is next month,
  // which the plan fills, from the month's header down, clear of the device pill.
  await page.getByTestId('calendar-next').click()
  await expect(cal.getByTestId('calendar-planned').first()).toBeVisible()
  await cal.evaluate((el) => {
    el.scrollIntoView({ block: 'start' })
    let box = el.parentElement
    while (box && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement
    ;(box ?? document.scrollingElement)?.scrollBy(0, -48)
  })
  await shot(page, 'calendar')
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

test('a run in the run and swim builder', async () => {
  const { page } = ctx
  await nav(page, 'Builder')
  await page.getByRole('radio', { name: 'Run', exact: true }).click()
  await expect(page.getByTestId('session-builder')).toBeVisible()
  // typed in as text, then shown as the steps it builds
  await page.getByRole('radio', { name: 'Text', exact: true }).click()
  await page.getByTestId('session-builder-text').fill(`sport: run\nname: ${RUN.build[0]}\n\n${RUN.build[1]}`)
  await page.getByRole('radio', { name: 'Steps', exact: true }).click()
  await expect(page.getByTestId('session-builder-name')).toHaveValue(RUN.build[0])
  await expect(page.getByTestId('session-section')).toHaveCount(3)
  await shot(page, 'builder-run')
  // leave it unsaved: saving would plan it on today, under Home's last picture
  await nav(page, 'Routes')
  await page.getByRole('button', { name: 'Discard changes' }).click()
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
