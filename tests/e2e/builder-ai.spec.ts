// "Describe a workout" in the builder, end to end in the built app, for a
// bike workout, a run and a swim. The AI provider is a fake Ollama server on
// localhost, so main's whole AI path runs (contract, service, zod) and the
// test sees exactly what the provider was sent.
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test, type Page } from '@playwright/test'
import { launchApp, type Launched } from './launch'

let ctx: Launched
let server: Server
/** Every request the fake provider got: its system prompt and the rider's message. */
const sent: { system: string; user: string }[] = []
let reply: unknown = null

test.beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (c: Buffer) => (body += c.toString()))
    req.on('end', () => {
      res.setHeader('content-type', 'application/json')
      if (req.url === '/api/chat') {
        const j = JSON.parse(body) as { model: string; messages: { role: string; content: string }[] }
        sent.push({ system: j.messages[0]!.content, user: j.messages.at(-1)!.content })
        res.end(JSON.stringify({ model: j.model, created_at: new Date().toISOString(), message: { role: 'assistant', content: JSON.stringify(reply) }, done: true, done_reason: 'stop' }))
      } else if (req.url === '/api/tags') res.end(JSON.stringify({ models: [{ name: 'fake-coach' }] }))
      else {
        res.statusCode = 404
        res.end('{}')
      }
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

async function ask(page: Page, request: string) {
  await page.getByTestId('builder-ai-input').fill(request)
  await page.getByTestId('builder-ai-draft').click()
}

test('a run: drafted into the steps, unsaved, and the rider can put back what they had', async () => {
  const { page } = ctx
  await page.getByRole('link', { name: 'Builder' }).click()
  await page.getByRole('radio', { name: 'Run', exact: true }).click()
  await expect(page.getByTestId('session-builder-name')).toHaveValue('New run')
  reply = { name: 'Hill repeats', notes: 'Strong up, easy down.', steps: 'Warmup\n- 15m Z2 HR\n\nHills 6x\n- 90s Z5 HR uphill\n- 2m Z1 HR jog down\n\nCooldown\n- 10m Z1 HR' }
  await ask(page, '45 min with hills')

  await expect(page.getByTestId('builder-notice')).toContainText('Drafted “Hill repeats” with fake-coach. It isn\'t saved')
  await expect(page.getByTestId('session-builder-name')).toHaveValue('Hill repeats')
  await expect(page.getByLabel('Notes')).toHaveValue('Strong up, easy down.')
  await expect(page.getByLabel('Section 2 repeats')).toHaveValue('6')
  await expect(page.getByLabel('Section 2 step 1 length')).toHaveValue('90')
  await expect(page.getByLabel('Section 2 step 1 note')).toHaveValue('uphill')
  await expect(page.getByTestId('builder-dirty')).toBeVisible()
  const last = sent.at(-1)!
  expect(last.system).toContain('Design one run or swim session')
  expect(last.user).toContain('Sport: run. The rider reads distances in kilometres')
  expect(last.user).toContain("The rider's request: 45 min with hills")

  await page.getByTestId('builder-notice-action').click()
  await expect(page.getByTestId('session-builder-name')).toHaveValue('New run')
  await expect(page.getByTestId('builder-dirty')).toHaveCount(0)
})

test('a swim: written for the pool the builder has, in its unit', async () => {
  const { page } = ctx
  await page.getByRole('radio', { name: 'Swim', exact: true }).click()
  await expect(page.getByTestId('session-builder-name')).toHaveValue('New swim')
  await page.getByLabel('Pool').selectOption('25y')
  reply = { name: 'CSS 4x100', notes: '', steps: 'Warmup\n- 500m easy\n\nMain set 4x\n- 100y 100% Pace\n- 20s rest\n\nCooldown\n- 200y easy' }
  await ask(page, '4 x 100 at CSS')

  await expect(page.getByTestId('session-builder-name')).toHaveValue('CSS 4x100')
  await expect(page.getByLabel('Pool')).toHaveValue('25y')
  // "500m" would be 500 minutes: a swim's is the pool's unit
  await expect(page.getByLabel('Section 1 step 1 length')).toHaveValue('500')
  await expect(page.getByLabel('Section 1 step 1 unit')).toHaveValue('y')
  await expect(page.getByLabel('Section 2 repeats')).toHaveValue('4')
  expect(sent.at(-1)!.user).toContain('Sport: swim, in a 25 yd pool')

  // an answer that can't be built leaves the draft as it is
  reply = { name: 'Broken', notes: '', steps: '- as fast as you can' }
  await ask(page, 'something odd')
  await expect(page.getByTestId('builder-ai-error')).toContainText("The AI's swim can't be built as it is: a step starts with its length")
  await expect(page.getByTestId('session-builder-name')).toHaveValue('CSS 4x100')

  // back to what was there: a new swim, still unsaved since the pool changed
  await page.getByTestId('builder-notice-action').click()
  await expect(page.getByTestId('session-builder-name')).toHaveValue('New swim')
  await expect(page.getByLabel('Pool')).toHaveValue('25y')
  await expect(page.getByTestId('builder-dirty')).toBeVisible()
})

test('a bike workout still drafts into the bike builder', async () => {
  const { page } = ctx
  await page.getByRole('radio', { name: 'Bike', exact: true }).click()
  // the swim before is unsaved
  await page.getByTestId('guard-discard').click()
  await expect(page.getByTestId('builder-name')).toBeVisible()
  reply = {
    name: 'Over-unders',
    description: 'Hold the overs.',
    tags: [],
    segments: [
      { kind: 'ramp', role: 'warmup', durationS: 600, from: 0.5, to: 0.75 },
      { kind: 'intervals', repeat: 4, onS: 120, onPower: 1.05, offS: 120, offPower: 0.9 },
      { kind: 'ramp', role: 'cooldown', durationS: 300, from: 0.6, to: 0.4 },
    ],
    cues: [],
  }
  await ask(page, '45 min over-unders')
  await expect(page.getByTestId('builder-notice')).toContainText('Drafted “Over-unders” with fake-coach.')
  await expect(page.getByTestId('builder-name')).toHaveValue('Over-unders')
  expect(sent.at(-1)!.system).toContain('Design a structured indoor workout')
  expect(sent.at(-1)!.user).toBe("The rider's request: 45 min over-unders")
})
