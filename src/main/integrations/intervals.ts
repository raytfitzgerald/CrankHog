// intervals.icu: personal API key (Basic auth, username "API_KEY").
// Athlete id "0" means "the owner of this key".
import type { SecretStore } from '../secrets/secret-store'
import { requestJson } from './http'

/** A planned ride from the athlete's intervals.icu calendar, trimmed to what CrankHog uses. */
export interface PlannedWorkoutEvent {
  id: string
  /** "2026-11-18T00:00:00", local to the athlete. */
  start_date_local: string
  name: string
  type: string | null
  /** The workout in intervals.icu's text format. */
  description: string | null
  /** The workout as a Zwift file, when intervals.icu could make one. */
  zwo: string | null
}

/** Longest calendar range one import may ask for. */
export const MAX_PLANNED_RANGE_DAYS = 92
const DATE = /^\d{4}-\d{2}-\d{2}$/
/** Bounds on what is passed on from a third party. */
const MAX_EVENTS = 400
const MAX_TEXT = 20_000
const MAX_ZWO = 200_000

export const INTERVALS_API = 'https://intervals.icu/api/v1'
const SECRET = 'intervals.config'

export interface IntervalsConfig {
  apiKey: string
  athleteId: string
}

export class IntervalsClient {
  constructor(
    private readonly secrets: SecretStore,
    private readonly api = INTERVALS_API,
  ) {}

  configure(cfg: IntervalsConfig): void {
    this.secrets.setJson(SECRET, cfg)
  }

  clear(): void {
    this.secrets.delete(SECRET)
  }

  status(): { configured: boolean; athleteId?: string } {
    const c = this.secrets.getJson<IntervalsConfig>(SECRET)
    return { configured: !!c, athleteId: c?.athleteId }
  }

  /**
   * The workouts planned on the athlete's calendar from `oldest` to `newest`
   * (local dates, both included). With ext=zwo each one comes with a Zwift
   * file of its structure; CrankHog parses that, or the text description.
   */
  async plannedWorkouts(oldest: string, newest: string): Promise<PlannedWorkoutEvent[]> {
    const c = this.secrets.getJson<IntervalsConfig>(SECRET)
    if (!c) throw new Error('intervals.icu is not configured')
    if (!DATE.test(oldest) || !DATE.test(newest) || newest < oldest) throw new Error('Not a date range')
    const days = (Date.parse(newest) - Date.parse(oldest)) / 86_400_000
    if (days > MAX_PLANNED_RANGE_DAYS) throw new Error(`The range is limited to ${MAX_PLANNED_RANGE_DAYS} days`)
    const url = new URL(`${this.api}/athlete/${encodeURIComponent(c.athleteId || '0')}/events`)
    url.searchParams.set('oldest', oldest)
    url.searchParams.set('newest', newest)
    url.searchParams.set('category', 'WORKOUT')
    url.searchParams.set('ext', 'zwo')
    const res = await requestJson<unknown>(url.toString(), { headers: { authorization: basicAuth(c.apiKey) } })
    if (!Array.isArray(res)) throw new Error('intervals.icu returned something other than a list of events')
    return res.flatMap(toPlanned).slice(0, MAX_EVENTS)
  }

  async uploadFit(upload: { bytes: Uint8Array; fileName: string; name: string; description?: string; externalId: string }): Promise<{ activityId: string }> {
    const c = this.secrets.getJson<IntervalsConfig>(SECRET)
    if (!c) throw new Error('intervals.icu is not configured')
    const url = new URL(`${this.api}/athlete/${encodeURIComponent(c.athleteId || '0')}/activities`)
    url.searchParams.set('name', upload.name)
    if (upload.description) url.searchParams.set('description', upload.description)
    url.searchParams.set('external_id', upload.externalId)
    const form = new FormData()
    form.set('file', new Blob([upload.bytes.slice()], { type: 'application/octet-stream' }), upload.fileName)
    const res = await requestJson<{ id?: string; icu_athlete_id?: string } | { id: string }[]>(url.toString(), {
      method: 'POST',
      headers: { authorization: basicAuth(c.apiKey) },
      body: form,
    })
    const id = Array.isArray(res) ? res[0]?.id : res.id
    if (!id) throw new Error('intervals.icu did not return an activity id')
    return { activityId: String(id) }
  }
}

const basicAuth = (apiKey: string) => `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max ? v : null)

/** One event from the API, if it is a planned workout CrankHog can use; malformed ones are dropped. */
function toPlanned(raw: unknown): PlannedWorkoutEvent[] {
  if (raw === null || typeof raw !== 'object') return []
  const e = raw as Record<string, unknown>
  if (e.category !== 'WORKOUT') return []
  const id = typeof e.id === 'number' || typeof e.id === 'string' ? String(e.id).slice(0, 40) : null
  const start = str(e.start_date_local, 40)
  if (!id || !start || !DATE.test(start.slice(0, 10))) return []
  let zwo: string | null = null
  const file = str(e.workout_file_base64, (MAX_ZWO * 4) / 3 + 4)
  if (file) {
    const text = Buffer.from(file, 'base64').toString('utf8')
    zwo = text.length <= MAX_ZWO ? text : null
  }
  return [{ id, start_date_local: start, name: (str(e.name, 300) ?? '').trim(), type: str(e.type, 40), description: str(e.description, MAX_TEXT), zwo }]
}
