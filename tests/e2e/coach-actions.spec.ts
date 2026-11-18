// The coach chat doing things, end to end in the built app: proposing changes
// the rider applies and undoes, and building a multisport plan through the
// conversation (questions, a draft, a revision, accept) that lands on the
// calendar. The AI is a fake Ollama server on localhost, so main's whole AI
// path runs: the chat stream with its tools written into the prompt, the
// fenced tool call held back and handed on, the planner's structured calls.
// The fake answers from a script keyed on the rider's question, and reads
// the refs it proposes with out of the data the app sent, as a model would.
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test, type Page } from '@playwright/test'
import { launchApp, type Launched } from './launch'

let ctx: Launched
let server: Server
/** Every chat turn the fake got: the system prompt and the rider's latest message. */
const chats: { system: string; user: string }[] = []
/** Every planner call: which prompt, and its input. */
const planner: { system: string; user: string }[] = []

const pad = (n: number) => String(n).padStart(2, '0')
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const ahead = (days: number) => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return key(d)
}
/** Days from today to the next Monday (never today). */
const toMonday = (() => {
  const d = new Date().getDay()
  return ((8 - d) % 7) || 7
})()
const monday = ahead(toMonday)
/** The plan's two weeks end with the race on week 2's Sunday. */
const race = ahead(toMonday + 13)
const day = (week: number, weekday: number) => ahead(toMonday + 7 * (week - 1) + weekday)

const tool = (name: string, input: unknown) => `\n\n\`\`\`crankhog-tool\n${JSON.stringify({ tool: name, input })}\n\`\`\``

/** The data the app sent with the rider's latest message. */
function dataOf(user: string): { calendar: { ref: string; name: string; date: string }[] } {
  return JSON.parse(/My training data \(JSON\):\n(.*)\n/.exec(user)![1]!) as { calendar: { ref: string; name: string; date: string }[] }
}

const BRIEF = {
  name: 'Lakeside sprint plan',
  race: { name: 'Lakeside sprint', date: race, kind: 'sprint triathlon (750 m swim, 20 km bike, 5 km run)' },
  startDate: monday,
  sports: ['swim', 'bike', 'run'],
  hoursPerWeek: { start: 5, peak: 6 },
  days: [
    { weekday: 1, maxMinutes: 60 },
    { weekday: 3, maxMinutes: 60 },
    { weekday: 5, maxMinutes: 120 },
  ],
  longRideDay: 5,
  longRunDay: null,
  athlete: 'Runs 20 km a week, rides twice, swims once in a 25 m pool.',
}

/** The coach's side of the conversation, by what the rider asked. */
function chatReply(user: string): string {
  const q = user.slice(user.lastIndexOf('Question: ') + 'Question: '.length)
  if (q.startsWith('Squash tomorrow'))
    return `Squash it is. Try not to hurt yourself.${tool('propose_changes', { summary: 'Squash tomorrow', actions: [{ type: 'add_session', date: ahead(1), sport: 'other', name: 'Squash', minutes: 60, effort: 'hard' }] })}`
  if (q.startsWith('Move squash')) {
    const squash = dataOf(user).calendar.find((e) => e.name === 'Squash')!
    return `Fine, the day after.${tool('propose_changes', { summary: 'Squash a day later', actions: [{ type: 'move', ref: squash.ref, to: ahead(2) }] })}`
  }
  if (q.startsWith('Make me a plan')) return 'Before I draft it:\n1. How many hours a week can you train?\n2. Which days, and how long each?\n3. Where do you swim?'
  if (q.startsWith('Six hours')) return `Drafting it now.${tool('draft_plan', BRIEF)}`
  if (q.startsWith('Less swimming')) return `One swim, then.${tool('revise_plan', { feedback: 'Less swimming: one swim in all, in week 2' })}`
  return 'Noted.'
}

const OUTLINE = (swim: number) => ({
  notes: 'One build week, then race week.',
  weeks: [
    { week: 1, phase: 'build', focus: 'Race fitness', hours: { swim, bike: 2, run: 1.5, other: 0 }, keySessions: ['Long ride'] },
    { week: 2, phase: 'taper', focus: 'Sharpen and rest', hours: { swim: 0.5, bike: 1.5, run: 1, other: 0 }, keySessions: ['Openers'] },
  ],
})
const s = (week: number, weekday: number, sport: string, name: string, steps: string) => ({ week, weekday, sport, name, steps, minutes: null, effort: null, notes: null })
const WEEKS = (swimInWeek1: boolean) => ({
  items: [
    ...(swimInWeek1 ? [s(1, 1, 'swim', 'CSS 8x100', 'Main set 8x\n- 100mtr 1:50/100m Pace\n- 15s rest')] : []),
    s(1, 3, 'run', 'Tempo run', '- 10m Z2 HR\n- 20m Z3 HR\n- 10m Z1 HR'),
    s(1, 5, 'bike', 'Long ride', '- 10m ramp 50-70%\n- 80m 68%\n- 10m 50%'),
    s(2, 1, 'swim', 'Easy swim', '- 1000mtr easy'),
    s(2, 3, 'run', 'Openers run', '- 15m Z2 HR\n4x\n- 30s Z5 HR\n- 90s Z1 HR'),
    s(2, 5, 'bike', 'Openers', '- 10m ramp 50-75%\n3x\n- 1m 110%\n- 2m 55%\n- 10m 55%'),
  ],
})

test.beforeAll(async () => {
  let revised = false
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
      const j = JSON.parse(body) as { model: string; stream?: boolean; format?: unknown; messages: { role: string; content: string }[] }
      const system = j.messages[0]!.content
      const user = j.messages.at(-1)!.content
      if (j.format) {
        // the planner: an outline, or some weeks' sessions
        planner.push({ system, user })
        const outline = system.includes("Outline the rider's training plan week by week")
        if (outline && user.includes("The rider's feedback")) revised = true
        const value = outline ? OUTLINE(revised ? 0 : 1) : WEEKS(!revised)
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ model: j.model, created_at: new Date().toISOString(), message: { role: 'assistant', content: JSON.stringify(value) }, done: true, done_reason: 'stop' }))
        return
      }
      chats.push({ system, user })
      res.setHeader('content-type', 'application/x-ndjson')
      for (const part of chatReply(user).match(/[\s\S]{1,12}/g)!) res.write(`${JSON.stringify({ model: j.model, created_at: '', message: { role: 'assistant', content: part }, done: false })}\n`)
      res.end(`${JSON.stringify({ model: j.model, created_at: '', message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop' })}\n`)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  ctx = await launchApp()
  await ctx.page.evaluate((h) => window.crankhog.invoke('ai.configure', { provider: 'ollama', model: 'fake-coach', ollamaHost: h }), host)
})
test.afterAll(async () => {
  await ctx?.close()
  await new Promise((resolve) => server?.close(resolve))
})

/** A store in CrankHog's IndexedDB, read straight from the page. */
function rows<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    (name) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('freegaz')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const q = open.result.transaction(name, 'readonly').objectStore(name).getAll()
          q.onsuccess = () => {
            resolve(q.result as T[])
            open.result.close()
          }
          q.onerror = () => reject(q.error)
        }
      }),
    store,
  )
}

/** Sends a message and waits for the coach to finish answering. */
async function ask(page: Page, text: string) {
  const before = chats.length
  await page.getByLabel('Message the coach').fill(text)
  await page.getByRole('button', { name: 'Send' }).click()
  await expect.poll(() => chats.length).toBe(before + 1)
  await expect(page.getByRole('button', { name: 'Stop' })).toHaveCount(0)
  await expect(page.getByLabel('Message the coach')).toBeFocused()
}

/** The coach page (a test after a failed one starts on a fresh app). */
async function toCoach(page: Page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Coach', exact: true }).click()
  await expect(page.getByTestId('chat-persona')).toBeVisible()
}

test('the coach proposes changes, the rider applies them, and undo puts things back', async () => {
  const { page } = ctx
  await toCoach(page)
  await ask(page, 'Squash tomorrow, 1 h, hard')

  // the tools were in the prompt, and the call never reached the rider as text
  expect(chats[0]!.system).toContain('Tools: this chat has no tool-calling interface')
  expect(chats[0]!.system).toContain('## propose_changes')
  await expect(page.getByText('Squash it is. Try not to hurt yourself.')).toBeVisible()
  await expect(page.getByText('crankhog-tool')).toHaveCount(0)

  const card = page.getByTestId('coach-changes').last()
  await expect(card.getByTestId('coach-change-line')).toHaveText([/^Plan Squash, 1 h hard, on /])
  await expect(card.getByTestId('coach-diff-day')).toContainText('+ Squash')
  // nothing has changed until the rider says so
  expect(await rows(page, 'schedule')).toEqual([])
  await page.screenshot({ path: test.info().outputPath('coach-proposal.png') })
  await card.getByTestId('coach-change-apply').click()
  await expect(card.getByTestId('coach-change-status')).toHaveText('Applied')
  expect((await rows<{ date: string; name: string }>(page, 'schedule')).map((e) => [e.date, e.name])).toEqual([[ahead(1), 'Squash']])

  // the next message tells the coach it was applied, and carries the session's ref for it to name
  await ask(page, 'Move squash to the day after')
  expect(chats.at(-1)!.user).toContain('[App] The rider applied your proposed changes ("Squash tomorrow").')
  const move = page.getByTestId('coach-changes').last()
  await expect(move.getByTestId('coach-change-line')).toHaveText([/^Move Squash from .+ to /])
  await move.getByTestId('coach-change-apply').click()
  await expect(move.getByTestId('coach-change-status')).toHaveText('Applied')
  expect((await rows<{ date: string }>(page, 'schedule')).map((e) => e.date)).toEqual([ahead(2)])
  await move.getByTestId('coach-change-undo').click()
  await expect(move.getByTestId('coach-change-status')).toHaveText('Undone: everything is as it was')
  expect((await rows<{ date: string }>(page, 'schedule')).map((e) => e.date)).toEqual([ahead(1)])
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})

test('a multisport plan built in the chat: questions, a draft, a revision, then on the calendar', async () => {
  const { page } = ctx
  await toCoach(page)
  await ask(page, 'Make me a plan for a sprint triathlon')
  // questions first: no card, nothing drafted
  await expect(page.getByText('Before I draft it:')).toBeVisible()
  await expect(page.getByTestId('coach-plan')).toHaveCount(0)
  expect(planner).toHaveLength(0)
  const drafted = planner.length

  await ask(page, 'Six hours max. Tue and Thu an hour, Saturday two. 25 m pool.')
  const first = page.getByTestId('coach-plan').first()
  await expect(first).toHaveAttribute('data-state', 'ready')
  // the outline, then both weeks in one block; the planner was told the race and the days
  expect(planner.slice(drafted).map((p) => (p.system.includes('Outline the rider') ? 'outline' : 'weeks'))).toEqual(['outline', 'weeks'])
  expect(planner[drafted]!.user).toContain(`Race: Lakeside sprint, sprint triathlon (750 m swim, 20 km bike, 5 km run), on ${race} (Sunday), in week 2.`)
  expect(planner[drafted + 1]!.user).toContain('Write every session of weeks 1 to 2')
  await expect(first.getByTestId('coach-plan-span')).toContainText('2 weeks from')
  await expect(first.getByTestId('coach-plan-week')).toHaveCount(2)
  await expect(first.getByTestId('coach-plan-session')).toHaveCount(6)
  await expect(first.getByTestId('coach-plan-sports')).toContainText('Swim')
  await first.getByTestId('coach-plan-week').first().locator('summary').first().click()
  await page.screenshot({ path: test.info().outputPath('coach-plan-draft.png') })
  // still nothing saved
  expect(await rows(page, 'plans')).toEqual([])

  await ask(page, 'Less swimming please')
  expect(chats.at(-1)!.user).toContain('[App] Draft 1 of the plan "Lakeside sprint plan" is ready and shown to the rider')
  // the draft rides along in the data for the coach to revise from
  expect(chats.at(-1)!.user).toContain('"planDraft":{"status":"shown to the rider for review, not saved yet"')
  const second = page.getByTestId('coach-plan').last()
  await expect(second).toHaveAttribute('data-state', 'ready')
  await expect(first).toHaveAttribute('data-state', 'superseded')
  expect(planner.at(-2)!.user).toContain("The rider's feedback: Less swimming: one swim in all, in week 2")
  await expect(second.getByTestId('coach-plan-session')).toHaveCount(5)

  await second.getByTestId('coach-plan-accept').click()
  await expect(second).toHaveAttribute('data-state', 'accepted')
  await expect(second.getByTestId('coach-plan-status')).toContainText('On your calendar: 5 sessions')
  await page.screenshot({ path: test.info().outputPath('coach-plan-accepted.png') })

  // every session on its day, the race an A event, the plan counted back from it
  const plans = await rows<{ id: string; name: string; anchor?: string; eventId?: string; onCalendar: boolean }>(page, 'plans')
  expect(plans).toMatchObject([{ name: 'Lakeside sprint plan', anchor: 'race', onCalendar: true }])
  const marks = await rows<{ id: string; date: string; kind: string; priority?: string }>(page, 'dayMarks')
  expect(marks.find((m) => m.id === plans[0]!.eventId)).toMatchObject({ date: race, kind: 'event', priority: 'A' })
  const entries = (await rows<{ date: string; name: string; sport?: string; planId?: string }>(page, 'schedule')).filter((e) => e.planId === plans[0]!.id)
  expect(entries.map((e) => [e.date, e.sport ?? 'ride', e.name]).sort()).toEqual(
    [
      [day(1, 3), 'run', 'Tempo run'],
      [day(1, 5), 'ride', 'Long ride'],
      [day(2, 1), 'swim', 'Easy swim'],
      [day(2, 3), 'run', 'Openers run'],
      [day(2, 5), 'ride', 'Openers'],
    ].sort(),
  )
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})
