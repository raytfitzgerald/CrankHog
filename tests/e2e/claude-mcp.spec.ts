// Claude using CrankHog, end to end: the rider turns Claude on in Settings,
// and the official MCP client runs the CrankHog add-on as Claude Code does
// (node, the add-on's copy in the profile, over stdio). Claude reads the
// training, changes the calendar, the rider undoes it in Settings, and the
// switches take the changes, then everything, away again.
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { expect, test } from '@playwright/test'
import { launchApp, type Launched } from './launch'

let ctx: Launched

test.afterEach(async () => {
  await ctx?.close()
})

const pad = (n: number) => String(n).padStart(2, '0')
const ahead = (days: number) => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const text = (r: Awaited<ReturnType<Client['callTool']>>) => (r.content as { type: string; text: string }[]).map((c) => c.text).join('')

test('Claude reads the training, changes the calendar, and the rider undoes it, through the CrankHog add-on', async () => {
  ctx = await launchApp()
  const { page, userData } = ctx
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByRole('tab', { name: 'AI', exact: true }).click()
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Claude', exact: true }) })
  const [useSwitch, changesSwitch] = [section.getByRole('switch').nth(0), section.getByRole('switch').nth(1)]
  await useSwitch.click()
  await expect(page.getByTestId('claude-status')).toContainText('Ready for Claude')
  const dir = join(userData, 'mcp')
  await expect(page.getByTestId('claude-code-command')).toContainText(`--dir "${dir}"`)

  const claude = new Client({ name: 'e2e-claude', version: '1.0.0' })
  await claude.connect(new StdioClientTransport({ command: process.execPath, args: [join(dir, 'crankhog-mcp.mjs'), '--dir', dir], stderr: 'pipe' }))
  try {
    await expect(page.getByTestId('claude-status')).toContainText('Claude is connected')
    expect((await claude.listTools()).tools.map((t) => t.name)).toContain('make_changes')

    const training = await claude.callTool({ name: 'get_training', arguments: {} })
    expect(training.isError).toBe(false)
    expect(text(training)).toContain(`"today"`)

    const made = await claude.callTool({
      name: 'make_changes',
      arguments: { summary: 'Squash on Thursday', actions: [{ type: 'add_session', date: ahead(2), sport: 'Other', name: 'Squash', minutes: 60, effort: 'hard', why: 'A hard hour off the bike' }] },
    })
    expect(made.isError, text(made)).toBe(false)
    const week = async () => text(await claude.callTool({ name: 'get_calendar', arguments: { from: ahead(0), to: ahead(7) } }))
    expect(await week()).toContain('"name":"Squash"')
    await expect(page.getByTestId('claude-changes')).toContainText('Squash on Thursday')
    await page.screenshot({ path: test.info().outputPath('claude-settings.png') })

    // the rider takes it back in Settings
    await page.getByTestId('claude-changes').getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByTestId('claude-changes')).toContainText('Undone')
    expect(await week()).not.toContain('Squash')

    // changes off: Claude only reads
    await changesSwitch.click()
    await expect.poll(async () => (await claude.listTools()).tools.map((t) => t.name)).not.toContain('make_changes')
    const refused = await claude.callTool({ name: 'make_changes', arguments: { summary: 'Again', actions: [{ type: 'add_session', date: ahead(2), sport: 'other', name: 'Squash', minutes: 60, effort: 'hard' }] } })
    expect(refused.isError).toBe(true)
    expect(text(refused)).toMatch(/has not let Claude change things/)

    // Claude off: the add-on says where to turn it on, and CrankHog isn't reachable
    await useSwitch.click()
    await expect.poll(async () => text(await claude.callTool({ name: 'get_training', arguments: {} }))).toMatch(/turned off in CrankHog/)
  } finally {
    await claude.close()
  }
})
