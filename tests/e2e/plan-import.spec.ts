// Importing a plan document, end to end in the built app. The AI provider is
// a fake Ollama server on localhost, so main's whole AI path runs (contract,
// service, zod) and the test sees exactly what the provider was sent. The
// documents are a PDF (read by pdf.js, its worker under the app's CSP), a
// Word file (mammoth) and a spreadsheet in the template's shape (SheetJS),
// so each reader is proven in the bundle, not only in the unit tests.
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test, type Page } from '@playwright/test'
import { makeDocx, makePdf, makeXlsx } from '../fixtures/plan-docs'
import { launchApp, type Launched } from './launch'

let ctx: Launched
let server: Server
let host = ''
/** Every request the fake provider got: its system prompt and the rider's message. */
const sent: { system: string; user: string; options?: Record<string, unknown> }[] = []
let reply: unknown = null

const pad = (n: number) => String(n).padStart(2, '0')
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** The Sunday `weeks` weeks after next Monday's week. */
function sundayAhead(weeks: number): string {
  const d = new Date()
  d.setHours(12)
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7) + 7 * weeks + 6)
  return key(d)
}

test.beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (c: Buffer) => (body += c.toString()))
    req.on('end', () => {
      res.setHeader('content-type', 'application/json')
      if (req.url === '/api/chat') {
        const j = JSON.parse(body) as { model: string; messages: { role: string; content: string }[]; options?: Record<string, unknown> }
        sent.push({ system: j.messages[0]!.content, user: j.messages.at(-1)!.content, options: j.options })
        res.end(JSON.stringify({ model: j.model, created_at: new Date().toISOString(), message: { role: 'assistant', content: JSON.stringify(reply) }, done: true, done_reason: 'stop' }))
      } else if (req.url === '/api/tags') res.end(JSON.stringify({ models: [{ name: 'fake-planner' }] }))
      else {
        res.statusCode = 404
        res.end('{}')
      }
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  ctx = await launchApp()
  await ctx.page.evaluate((h) => window.crankhog.invoke('ai.configure', { provider: 'ollama', model: 'fake-planner', ollamaHost: h }), host)
})
test.afterAll(async () => {
  await ctx?.close()
  await new Promise((resolve) => server?.close(resolve))
})

/** Workouts → Training plan → Add a training plan, with no event, to the plan document step. */
async function toDocumentStep(page: Page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Workouts', exact: true }).click()
  await page.getByTestId('workout-tab-plan').click()
  await page.getByTestId('plan-new').click()
  await page.getByRole('radio', { name: 'No event' }).click()
  await page.getByTestId('new-plan-next').click()
  await page.getByTestId('new-plan-document').click()
  await expect(page.getByTestId('doc-import-pick')).toBeVisible()
}

const item = (week: number, weekday: number, sport: string, name: string, steps: string) => ({ date: null, week, weekday, sport, name, steps, minutes: null, effort: null, notes: null })

test('a PDF plan: read here, sent only when the rider says so, reviewed, then put on the calendar with its race', async () => {
  const { page } = ctx
  const race = sundayAhead(1)
  reply = {
    planName: 'Spring classic plan',
    raceName: 'Spring classic',
    raceDate: race,
    startDate: null,
    countdown: null,
    items: [
      item(1, 1, 'bike', 'Sweet spot 3x12', 'Warmup\n- 10m ramp 50-75%\nMain set 3x\n- 12m 90%\n- 5m 55%\nCooldown\n- 10m 50%'),
      item(1, 3, 'run', 'Easy run', '- 40m Z2 HR'),
      item(2, 1, 'bike', 'Openers', '- 20 minutes hard'),
      item(2, 6, 'bike', 'Race', '- 2h 85%'),
    ],
    skipped: [{ text: 'Optional brick', reason: 'No length given.' }],
  }
  const pdf = makePdf([
    { x: 72, y: 740, text: 'Spring classic plan' },
    { x: 72, y: 700, text: 'Week 1' },
    { x: 72, y: 680, text: 'Tue' },
    { x: 200, y: 680, text: 'Sweet spot 3x12 (90%)' },
    { x: 72, y: 660, text: 'Thu' },
    { x: 200, y: 660, text: 'Easy run 40 min' },
  ])
  await toDocumentStep(page)
  await page.getByTestId('doc-import-file').setInputFiles({ name: 'Spring plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) })

  // read on this computer; the rider is told where it would go, and nothing has gone yet
  await expect(page.getByTestId('doc-import-notice')).toContainText(`Ollama at ${host} (fake-planner)`)
  await expect(page.getByTestId('doc-import-notice')).toContainText('Nothing else goes with it')
  expect(sent).toHaveLength(0)
  await page.screenshot({ path: test.info().outputPath('plan-import-notice.png') })

  await page.getByTestId('doc-import-ai').click()
  await expect(page.getByTestId('doc-import-review')).toBeVisible()
  expect(sent).toHaveLength(1)
  // pdf.js read the page, a table's columns joined by " | "; the provider got the text and today's date, nothing about the rider
  expect(sent[0]!.system).toContain('Read it into sessions CrankHog can put on their calendar')
  expect(sent[0]!.user).toContain('<document>\nSpring classic plan\n\nWeek 1\nTue | Sweet spot 3x12 (90%)\nThu | Easy run 40 min\n</document>')
  expect(sent[0]!.user).toMatch(/^Today is \d{4}-\d{2}-\d{2}\.\nThe rider's training plan document, "Spring plan.pdf":/)
  // Ollama gets a context window that holds the prompt and a long answer, not its default few thousand tokens
  expect(sent[0]!.options).toMatchObject({ num_ctx: 16_384 })
  expect(sent[0]!.options!.num_predict).toBeGreaterThan(12_000)
  expect(sent[0]!.options!.num_predict).toBeLessThan(16_384)

  // the review: what will be made, what won't and why, before anything is saved
  await expect(page.getByTestId('doc-import-ready-item')).toHaveCount(2)
  await expect(page.getByTestId('doc-import-summary')).toContainText('2 sessions will be made · 1 ride, 1 run')
  await expect(page.getByTestId('doc-import-failed-item')).toContainText('Openers')
  await expect(page.getByTestId('doc-import-failed-item')).toContainText('Line 1:')
  await page.getByText(/^Left out/).click()
  await expect(page.getByTestId('doc-import-left-out-item')).toContainText('On race day')
  await expect(page.getByRole('switch')).toBeChecked()
  await expect(page.getByTestId('doc-import-name')).toHaveValue('Spring classic plan')
  await page.screenshot({ path: test.info().outputPath('plan-import-review.png') })

  await page.getByTestId('doc-import-save').click()
  await expect(page.getByRole('status').filter({ hasText: 'Spring classic plan: 2 sessions on your calendar.' })).toBeVisible()
  const card = page.getByTestId('plan-card').filter({ hasText: 'Spring classic plan' })
  await expect(card).toContainText('2 workouts')
  await expect(card).toContainText('Spring classic in')
  await expect(card.getByLabel('On the calendar')).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})

test('a Word plan reaches the provider with its table rows intact', async () => {
  const { page } = ctx
  reply = { planName: null, raceName: null, raceDate: null, startDate: null, countdown: null, items: [item(1, 2, 'swim', 'CSS 10x100', 'Main set 10x\n- 100mtr 1:40/100m Pace\n- 15s rest')], skipped: [] }
  const docx = makeDocx(['Winter swim block', 'Week 1', [['Day', 'Session'], ['Wed', 'CSS 10x100 & drills']]])
  await toDocumentStep(page)
  await page.getByTestId('doc-import-file').setInputFiles({ name: 'Swim block.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(docx) })
  const before = sent.length
  await page.getByTestId('doc-import-ai').click()
  await expect(page.getByTestId('doc-import-ready-item')).toHaveCount(1)
  expect(sent).toHaveLength(before + 1)
  expect(sent.at(-1)!.user).toContain('<document>\nWinter swim block\n\nWeek 1\nDay | Session\nWed | CSS 10x100 & drills\n</document>')
  // nothing saved: back out
  await page.getByTestId('doc-import-back').click()
  await expect(page.getByTestId('doc-import-pick')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('plan-card').filter({ hasText: 'Swim block' })).toHaveCount(0)
})

test('the template in a spreadsheet is read without AI', async () => {
  const { page } = ctx
  const day = sundayAhead(2)
  const xlsx = makeXlsx({
    Plan: [
      ['date', 'sport', 'name', 'steps', 'notes'],
      [new Date(`${day}T12:00:00`), 'bike', 'Endurance 90', '- 10m ramp 50-70%; - 70m 68%; - 10m 50%', 'Easy'],
      [new Date(`${day}T12:00:00`), 'run', 'Brick run', '- 20m Z2 HR', ''],
      [new Date(`${day}T12:00:00`), 'cycling', 'Spin', '- 30m 60%', ''],
    ],
  })
  await toDocumentStep(page)
  await page.getByTestId('doc-import-file').setInputFiles({ name: 'Block 2.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(xlsx) })
  const before = sent.length
  await page.getByTestId('doc-import-template').click()
  await expect(page.getByTestId('doc-import-ready-item')).toHaveCount(3)
  await page.getByTestId('doc-import-save').click()
  await expect(page.getByRole('status').filter({ hasText: 'Block 2: 3 sessions on your calendar.' })).toBeVisible()
  expect(sent).toHaveLength(before)
})
