// Tools for a model without tool calling (a local model in Ollama: some have
// it, many don't, and it can't be told which ahead). The tools go in the
// system prompt, and the model calls one by ending its reply with a fenced
// block holding the call as JSON. The block is held back from the stream,
// taken out of the reply, and handed on as a tool call, as a native one is.
import type { AiTool, AiToolCall } from './types'
import { toolJsonSchema } from './coach-tools'

export const TOOL_FENCE = 'crankhog-tool'
const OPEN = '```' + TOOL_FENCE

/** The tools, and how to call one, for the end of the system prompt. */
export function textToolsPrompt(tools: readonly AiTool[]): string {
  return [
    'Tools: this chat has no tool-calling interface, so to call a tool, end your reply with a fenced block like this one and nothing after it:',
    '',
    `${OPEN}`,
    '{"tool": "propose_changes", "input": {"summary": "…", "actions": [ … ]}}',
    '```',
    '',
    "The input is JSON matching the tool's input schema. One block per tool at most. The rider never sees the block, only the card CrankHog makes from it, so say in your reply what you're proposing.",
    ...tools.flatMap((t) => ['', `## ${t.name}`, t.description, '', `Input schema: ${JSON.stringify(toolJsonSchema(t))}`]),
  ].join('\n')
}

const known = (tools: readonly AiTool[], name: unknown): name is string => typeof name === 'string' && tools.some((t) => t.name === name)

/** A block's JSON as a call: {"tool", "input"}, or the near misses models write ({"name", "arguments"}). */
function callOf(json: string, tools: readonly AiTool[]): AiToolCall | null {
  let v: unknown
  try {
    v = JSON.parse(json)
  } catch {
    return null
  }
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const name = o.tool ?? o.name
  if (!known(tools, name)) return null
  const input = o.input ?? o.arguments ?? o.parameters
  return { name, input: typeof input === 'string' ? safeParse(input) : input }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}

/**
 * The reply without its tool blocks, and the calls they held. A crankhog-tool
 * block counts wherever it is (an unclosed one runs to the end); so does a
 * json block holding a call to one of the tools, which models write too.
 */
export function extractToolCalls(text: string, tools: readonly AiTool[]): { text: string; calls: AiToolCall[] } {
  const calls: AiToolCall[] = []
  const fence = /```(crankhog-tool|json)?[^\S\n]*\n([\s\S]*?)(?:\n?```|$)/g
  const kept = text.replace(fence, (block, lang: string | undefined, body: string) => {
    if (lang !== TOOL_FENCE && lang !== 'json') return block
    const call = callOf(body.trim(), tools)
    if (!call) return lang === TOOL_FENCE ? '' : block
    calls.push(call)
    return ''
  })
  return { text: kept.replace(/\n{3,}/g, '\n\n').trim(), calls }
}

/**
 * Streamed text with any crankhog-tool block held back: push each delta, and
 * send on what it returns. Text that might be the start of a block waits
 * until it's clear it isn't.
 */
export class ToolBlockFilter {
  private held = ''
  private inBlock = false

  push(delta: string): string {
    if (this.inBlock) return ''
    const text = this.held + delta
    const at = text.indexOf(OPEN)
    if (at >= 0) {
      this.inBlock = true
      this.held = ''
      return text.slice(0, at)
    }
    // keep back the longest tail that could still grow into the fence
    let keep = 0
    for (let k = Math.min(OPEN.length - 1, text.length); k > 0; k--) {
      if (OPEN.startsWith(text.slice(-k))) {
        keep = k
        break
      }
    }
    this.held = text.slice(text.length - keep)
    return text.slice(0, text.length - keep)
  }

  /** What was held back at the end, when it turned out not to be a block. */
  flush(): string {
    const rest = this.inBlock ? '' : this.held
    this.held = ''
    return rest
  }
}
