// How the CrankHog add-on in Claude talks to the app: JSON, one message a
// line, over a Unix socket only the rider's account can open. The add-on
// speaks MCP to Claude; this is the smaller conversation behind it.
//
//   add-on → app   {"id":1,"method":"list"}
//                  {"id":2,"method":"call","name":"get_training","arguments":{}}
//   app → add-on   {"id":1,"tools":[…],"instructions":"…"}
//                  {"id":2,"text":"…","isError":false}
//                  {"id":3,"error":"…"}            (the request itself was wrong)
//                  {"event":"tools-changed"}       (Settings changed what Claude may do)
import { z } from 'zod'

/** The longest line either side sends: a plan of 800 sessions with steps fits with room to spare. */
export const MAX_LINE = 4 * 1024 * 1024

export const WireRequestSchema = z.discriminatedUnion('method', [
  z.object({ id: z.number().int(), method: z.literal('list') }),
  z.object({ id: z.number().int(), method: z.literal('call'), name: z.string().max(64), arguments: z.unknown().optional() }),
])
export type WireRequest = z.infer<typeof WireRequestSchema>

/**
 * Splits a byte stream into lines. Feed it chunks; it calls back with each
 * whole line, and gives up (returns false) on a line longer than MAX_LINE.
 */
export class LineReader {
  private buf = ''

  constructor(
    private readonly onLine: (line: string) => void,
    private readonly max = MAX_LINE,
  ) {}

  push(chunk: string): boolean {
    this.buf += chunk
    let nl = this.buf.indexOf('\n')
    while (nl !== -1) {
      const line = this.buf.slice(0, nl).replace(/\r$/, '')
      this.buf = this.buf.slice(nl + 1)
      if (line.trim()) this.onLine(line)
      nl = this.buf.indexOf('\n')
    }
    return this.buf.length <= this.max
  }
}
