#!/usr/bin/env node
// CrankHog's add-on for Claude (Claude Desktop, Claude Code): an MCP server
// over stdio that passes Claude's tool calls to the CrankHog app. It has no
// dependencies and runs on Claude Desktop's own Node or any Node 18+.
//
//   node crankhog-mcp.mjs --dir "<CrankHog's userData>/mcp"
//
// The app writes mcp.json into that folder while Claude is turned on in its
// Settings: where its socket is, the tools and instructions, and the app to
// open when it's closed. The tools themselves run in the app (src/core/mcp,
// src/renderer/src/mcp); this file only speaks MCP and keeps the line to the
// app open. Its wire format is in src/core/mcp/wire.ts.
//
// Claude Desktop still opens with MCP's initialize handshake, so that is what
// this speaks (protocol versions 2024-11-05 to 2025-11-25). Anything else it
// doesn't know, such as a newer client's server/discover probe, gets "method
// not found" at once. Starting has no side effects: CrankHog is opened only
// when Claude calls a tool. Logs go to stderr; stdout carries MCP only.
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { join } from 'node:path'

const VERSION = '1.0.0'
const PROTOCOLS = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25']
const LATEST = PROTOCOLS[PROTOCOLS.length - 1]
const MAX_LINE = 4 * 1024 * 1024
const CALL_TIMEOUT_MS = 180_000
const OPEN_WAIT_MS = 45_000
const FALLBACK_INSTRUCTIONS = "CrankHog is the athlete's training app on their Mac. Read get_training before you advise or change anything."

const log = (...a) => process.stderr.write(`[crankhog-mcp] ${a.join(' ')}\n`)

function argValue(name) {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}

const dir = argValue('--dir')
if (!dir) {
  log('usage: crankhog-mcp.mjs --dir <folder>')
  process.exit(2)
}

/** What the app last wrote: { socket, tools, instructions, app }, or null when Claude is turned off in CrankHog. */
function manifest() {
  try {
    const m = JSON.parse(readFileSync(join(dir, 'mcp.json'), 'utf8'))
    return m && typeof m.socket === 'string' ? m : null
  } catch {
    return null
  }
}

// ---- stdout: MCP to Claude ---------------------------------------------------

function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`)
}
const reply = (id, result) => send({ jsonrpc: '2.0', id, result })
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } })

// ---- the line to the app -----------------------------------------------------

let sock = null
let connecting = null
let nextId = 1
const pending = new Map()
let initialized = false

function lines(onLine) {
  let buf = ''
  return (chunk) => {
    buf += chunk
    let nl = buf.indexOf('\n')
    while (nl !== -1) {
      const line = buf.slice(0, nl)
      buf = buf.slice(nl + 1)
      if (line.trim()) onLine(line)
      nl = buf.indexOf('\n')
    }
    return buf.length <= MAX_LINE
  }
}

/** Connects to the app once; resolves to the socket, or null if it isn't there. */
function tryConnect() {
  if (sock) return Promise.resolve(sock)
  if (connecting) return connecting
  const m = manifest()
  if (!m) return Promise.resolve(null)
  connecting = new Promise((resolve) => {
    const s = connect(m.socket)
    s.setEncoding('utf8')
    const feed = lines((line) => {
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        return
      }
      if (msg && msg.event === 'tools-changed') {
        if (initialized) send({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' })
        return
      }
      const p = msg && pending.get(msg.id)
      if (!p) return
      pending.delete(msg.id)
      clearTimeout(p.timer)
      p.resolve(msg)
    })
    s.once('connect', () => {
      sock = s
      connecting = null
      resolve(s)
    })
    s.on('data', (chunk) => {
      if (!feed(chunk)) s.destroy()
    })
    s.on('error', () => undefined)
    s.on('close', () => {
      if (sock === s) sock = null
      if (connecting) {
        connecting = null
        resolve(null)
      }
      for (const [id, p] of pending) {
        clearTimeout(p.timer)
        pending.delete(id)
        p.resolve(null)
      }
    })
  })
  return connecting
}

/** One request to the app; resolves to its answer, or null if the app went away. */
async function ask(s, req, timeoutMs) {
  const id = nextId++
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      resolve({ id, text: 'CrankHog took too long to answer. Try again.', isError: true })
    }, timeoutMs)
    pending.set(id, { resolve, timer })
    s.write(`${JSON.stringify({ id, ...req })}\n`)
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The app, opened in the background if it's closed and Claude is turned on in it. */
async function app() {
  const s = await tryConnect()
  if (s) return s
  const m = manifest()
  if (!m) return null
  if (m.app) {
    log('opening', m.app)
    execFile('open', ['-g', m.app], () => undefined)
  }
  const until = Date.now() + (m.app ? OPEN_WAIT_MS : 0)
  while (Date.now() < until) {
    await sleep(500)
    const again = await tryConnect()
    if (again) return again
  }
  return null
}

// ---- MCP ----------------------------------------------------------------------

async function toolsList(id) {
  const s = await tryConnect()
  const answer = s ? await ask(s, { method: 'list' }, 10_000) : null
  if (answer && Array.isArray(answer.tools)) return reply(id, { tools: answer.tools })
  // closed: what it offered last, so Claude knows the tools are there
  reply(id, { tools: manifest()?.tools ?? [] })
}

const closedText = () =>
  manifest()
    ? "CrankHog isn't open, and didn't open. Ask the athlete to open CrankHog on their Mac, then try again."
    : 'Claude is turned off in CrankHog. The athlete can turn it on in CrankHog: Settings, AI, Claude.'

async function toolsCall(id, params) {
  const name = params && typeof params.name === 'string' ? params.name : null
  if (!name) return fail(id, -32602, 'tools/call needs a tool name')
  const s = await app()
  if (!s) return reply(id, { content: [{ type: 'text', text: closedText() }], isError: true })
  const answer = await ask(s, { method: 'call', name, arguments: params.arguments ?? {} }, CALL_TIMEOUT_MS)
  if (!answer) return reply(id, { content: [{ type: 'text', text: 'CrankHog closed before it answered. Try again.' }], isError: true })
  if (typeof answer.error === 'string') return fail(id, -32602, answer.error)
  reply(id, { content: [{ type: 'text', text: String(answer.text ?? '') }], isError: answer.isError === true })
}

function initialize(id, params) {
  const asked = params && typeof params.protocolVersion === 'string' ? params.protocolVersion : LATEST
  const m = manifest()
  reply(id, {
    protocolVersion: PROTOCOLS.includes(asked) ? asked : LATEST,
    capabilities: { tools: { listChanged: true } },
    serverInfo: { name: 'crankhog', title: 'CrankHog', version: VERSION, websiteUrl: 'https://crankhog.app' },
    instructions: typeof m?.instructions === 'string' ? m.instructions : FALLBACK_INSTRUCTIONS,
  })
}

async function handle(msg) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') return
  const isRequest = 'id' in msg && msg.id !== null && typeof msg.method === 'string'
  if (!isRequest) {
    // notifications (and stray responses) get no answer
    if (msg.method === 'notifications/initialized') {
      initialized = true
      // listen for Settings changes; never opens the app
      void tryConnect()
    }
    return
  }
  try {
    switch (msg.method) {
      case 'initialize':
        return initialize(msg.id, msg.params)
      case 'ping':
        return reply(msg.id, {})
      case 'tools/list':
        return await toolsList(msg.id)
      case 'tools/call':
        return await toolsCall(msg.id, msg.params)
      default:
        return fail(msg.id, -32601, `Method not found: ${msg.method}`)
    }
  } catch (e) {
    fail(msg.id, -32603, e instanceof Error ? e.message : String(e))
  }
}

log(`version ${VERSION} on Node ${process.version}`)
process.stdin.setEncoding('utf8')
const feedStdin = lines((line) => {
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
  }
  void handle(msg)
})
process.stdin.on('data', (chunk) => {
  if (!feedStdin(chunk)) {
    log('a message was too long')
    process.exit(1)
  }
})
process.stdin.on('end', () => process.exit(0))
