// Building a training plan from a survey by classic periodization: count back
// from the event, give each block a purpose, and spread the rider's weekly
// hours over the days they can ride. The result is a PlanSkeleton (weeks of
// typed sessions with lengths), which is also what the AI planner returns;
// fillSkeleton then gives each session a real workout.
import { weekdayOf, type PlanSurvey } from './plan'
import { addDays, dateKeyToMs, type DateKey } from './schedule'

export type SessionType = 'endurance' | 'tempo' | 'sweet-spot' | 'threshold' | 'vo2max' | 'anaerobic' | 'recovery' | 'long' | 'test'
export type Phase = 'base' | 'build' | 'specialty' | 'taper' | 'recovery'

export interface SkeletonSession {
  /** 0 = Monday … 6 = Sunday. */
  day: number
  type: SessionType
  minutes: number
  /** One line on what the session is for. */
  intent: string
}

export interface SkeletonWeek {
  phase: Phase
  sessions: SkeletonSession[]
}

export interface PlanSkeleton {
  weeks: SkeletonWeek[]
}

export const SESSION_TYPES: readonly SessionType[] = ['endurance', 'tempo', 'sweet-spot', 'threshold', 'vo2max', 'anaerobic', 'recovery', 'long', 'test']
export const PHASES: readonly Phase[] = ['base', 'build', 'specialty', 'taper', 'recovery']

const INTENT: Record<SessionType, string> = {
  endurance: 'Steady aerobic riding, all conversation pace.',
  tempo: 'Long, steady efforts in the upper aerobic range.',
  'sweet-spot': 'Long intervals just under threshold: the most fitness for the fatigue.',
  threshold: 'Intervals at FTP, to push it up.',
  vo2max: 'Hard three to five minute efforts, for the top end.',
  anaerobic: 'Short, very hard efforts and sprints.',
  recovery: 'Easy spinning, so the hard work lands.',
  long: 'The long ride: time in the saddle, mostly endurance.',
  test: 'A ramp test, to size every workout after it.',
}

/** Share of the week each phase rides. */
const VOLUME: Record<Phase, number> = { base: 1, build: 1, specialty: 1, recovery: 0.6, taper: 0.5 }
const LONG_SHARE = 0.35
const MIN_SESSION = 30
const MAX_SESSION = 300
const TEST_MINUTES = 45
/** The longest plan the AI outlines. A plan to an event further off rides base by CrankHog's rules first (baseSkeleton). */
export const MAX_AI_WEEKS = 26

/** Weeks from the start to the event, a part week counting as one. */
export function planWeeks(startDate: DateKey, eventDate: DateKey): number {
  const days = Math.round((dateKeyToMs(eventDate) - dateKeyToMs(startDate)) / 86_400_000)
  return Math.max(1, Math.ceil(days / 7))
}

function phases(weeks: number, goal: PlanSurvey['goal'], toEvent: boolean): Phase[] {
  const taper = toEvent ? 1 : 0
  const specialty = toEvent ? Math.min(3, Math.max(0, weeks - 3)) : 0
  const rest = Math.max(0, weeks - taper - specialty)
  // an endurance goal without an event stays in base, with its recovery weeks
  const build = goal === 'endurance' && !toEvent ? 0 : Math.floor(rest / 2)
  const blocks: Phase[] = [...Array<Phase>(rest - build).fill('base'), ...Array<Phase>(build).fill('build')]
  // every fourth week of base and build is a recovery week
  const withRecovery = blocks.map((p, i): Phase => ((i + 1) % 4 === 0 ? 'recovery' : p))
  return [...withRecovery, ...Array<Phase>(specialty).fill('specialty'), ...Array<Phase>(taper).fill('taper')]
}

/** The hard sessions of a week, in the order they go on the hard days. */
function hardTypes(phase: Phase, s: Pick<PlanSurvey, 'goal' | 'focus'>): SessionType[] {
  switch (phase) {
    case 'recovery':
      return []
    case 'taper':
      return ['vo2max']
    case 'base':
      return s.goal === 'endurance' ? ['tempo'] : ['sweet-spot', 'tempo']
    case 'build':
      if (s.goal === 'endurance') return ['sweet-spot']
      if (s.goal === 'event' && (s.focus === 'climbing' || s.focus === 'time-trial')) return ['threshold', 'sweet-spot']
      if (s.goal === 'event' && s.focus === 'criterium') return ['vo2max', 'threshold']
      return ['threshold', 'vo2max']
    case 'specialty':
      if (s.focus === 'climbing') return ['threshold', 'sweet-spot']
      if (s.focus === 'time-trial') return ['threshold', 'vo2max']
      if (s.focus === 'criterium') return ['anaerobic', 'vo2max']
      return ['vo2max', 'threshold']
  }
}

const round15 = (m: number) => Math.min(MAX_SESSION, Math.max(MIN_SESSION, Math.round(m / 15) * 15))

function week(phase: Phase, s: PlanSurvey): SkeletonWeek {
  const days = [...new Set(s.rideDays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b)
  if (days.length === 0) return { phase, sessions: [] }
  const total = s.hoursPerWeek * 60 * VOLUME[phase]
  const long = s.longDay !== null && days.includes(s.longDay) && days.length > 1 ? s.longDay : null
  const others = days.filter((d) => d !== long)
  const longMinutes = long !== null ? total * LONG_SHARE : 0
  const each = (total - longMinutes) / others.length
  const types = hardTypes(phase, s)
  const hardCount = Math.min(types.length, others.length === 1 ? 1 : others.length - 1)
  // hard days spread out: every other day first, then whatever is left
  const order = [...others.filter((_, i) => i % 2 === 0), ...others.filter((_, i) => i % 2 === 1)]
  const hard = new Map(order.slice(0, hardCount).map((d, i) => [d, types[i]!]))
  const easy: SessionType = phase === 'recovery' || phase === 'taper' ? 'recovery' : 'endurance'
  const sessions = days.map((day): SkeletonSession => {
    if (day === long) {
      const type: SessionType = phase === 'recovery' || phase === 'taper' ? 'endurance' : 'long'
      return { day, type, minutes: round15(longMinutes), intent: INTENT[type] }
    }
    const type = hard.get(day) ?? easy
    return { day, type, minutes: round15(each), intent: INTENT[type] }
  })
  return { phase, sessions }
}

/**
 * A plan of `weeks` weeks from the survey, from its start date. `toEvent` ends
 * it with a specialty block and a taper into the event.
 */
export function builtinSkeleton(survey: PlanSurvey, weeks: number, toEvent: boolean): PlanSkeleton {
  const out = phases(Math.max(1, Math.round(weeks)), survey.goal, toEvent).map((p) => week(p, survey))
  return withOpeningTest(fromStart({ weeks: out }, survey.startDate), survey)
}

/**
 * `weeks` weeks of base riding, a recovery week every fourth, opening with a
 * ramp test as builtinSkeleton does. They come before the AI's weeks in a plan
 * longer than MAX_AI_WEEKS, so the AI's taper still lands on the event.
 */
export function baseSkeleton(survey: PlanSurvey, weeks: number): PlanSkeleton {
  const out = Array.from({ length: Math.max(0, Math.round(weeks)) }, (_, i) => week((i + 1) % 4 === 0 ? 'recovery' : 'base', survey))
  return withOpeningTest({ weeks: out }, survey)
}

/** The plan opens with a ramp test on its first ride (except an endurance plan, or a taper alone). */
function withOpeningTest(skeleton: PlanSkeleton, survey: Pick<PlanSurvey, 'goal'>): PlanSkeleton {
  const wi = skeleton.weeks.findIndex((w) => w.sessions.length > 0)
  const first = skeleton.weeks[wi]
  if (!first || survey.goal === 'endurance' || first.phase === 'taper') return skeleton
  const sessions = [{ ...first.sessions[0]!, type: 'test' as const, minutes: TEST_MINUTES, intent: INTENT.test }, ...first.sessions.slice(1)]
  return { weeks: skeleton.weeks.map((w, i) => (i === wi ? { ...w, sessions } : w)) }
}

/**
 * The sessions from the start date on: the first week loses the days before
 * a mid-week start. A test among them moves to the first ride left, so the
 * plan still opens with it.
 */
export function fromStart(skeleton: PlanSkeleton, startDate: DateKey): PlanSkeleton {
  const head = skeleton.weeks[0]
  const from = weekdayOf(startDate)
  if (!head || head.sessions.every((s) => s.day >= from)) return skeleton
  const lostTest = head.sessions.find((s) => s.day < from && s.type === 'test')
  const weeks = [{ ...head, sessions: head.sessions.filter((s) => s.day >= from) }, ...skeleton.weeks.slice(1)]
  const wi = weeks.findIndex((w) => w.sessions.length > 0)
  const first = weeks[wi]?.sessions[0]
  if (!lostTest || !first || first.type === 'test') return { weeks }
  return { weeks: weeks.map((w, i) => (i === wi ? { ...w, sessions: [{ ...first, type: 'test', minutes: lostTest.minutes, intent: lostTest.intent }, ...w.sessions.slice(1)] } : w)) }
}

/** Each session's calendar day: week w, weekday d, counted from the Monday of the start's week. Days before the start are dropped. */
export function skeletonDates(skeleton: PlanSkeleton, startDate: DateKey): { date: DateKey; week: number; session: number }[] {
  const monday = addDays(startDate, -((new Date(dateKeyToMs(startDate)).getDay() + 6) % 7))
  const out: { date: DateKey; week: number; session: number }[] = []
  skeleton.weeks.forEach((w, wi) =>
    w.sessions.forEach((s, si) => {
      const date = addDays(monday, wi * 7 + s.day)
      if (date >= startDate) out.push({ date, week: wi, session: si })
    }),
  )
  return out
}

/** What fillSkeleton needs to know about a library workout. */
export interface LibraryCandidate {
  id: string
  tags: readonly string[]
  durationS: number
  ftpTest?: string
}

const TAGS: Record<Exclude<SessionType, 'test'>, readonly string[]> = {
  endurance: ['endurance'],
  long: ['endurance'],
  tempo: ['tempo'],
  'sweet-spot': ['sweet-spot'],
  threshold: ['threshold'],
  vo2max: ['vo2max'],
  anaerobic: ['anaerobic', 'sprint'],
  recovery: ['recovery', 'endurance'],
}
/** How far from the session's length a workout may be and still fit. */
const TOLERANCE = 0.35
/** Each earlier use of a workout counts as this share of the target's length, so plans vary. */
const REPEAT_PENALTY = 0.15

/**
 * A library workout for each session: the right kind, closest in length,
 * preferring ones not used yet. Rude workouts (tagged "fun") and FTP tests
 * are never picked, except a ramp test for a test session. Sessions nothing
 * fits are left null, for the AI planner to write.
 */
export function fillSkeleton(skeleton: PlanSkeleton, library: readonly LibraryCandidate[]): { picks: (string | null)[][]; unfilled: { week: number; session: number }[] } {
  const usable = library.filter((w) => !w.tags.includes('fun'))
  const ramp = usable.find((w) => w.ftpTest === 'ramp')
  const used = new Map<string, number>()
  const unfilled: { week: number; session: number }[] = []
  const picks = skeleton.weeks.map((w, wi) =>
    w.sessions.map((s, si) => {
      if (s.type === 'test') {
        if (!ramp) unfilled.push({ week: wi, session: si })
        return ramp?.id ?? null
      }
      const target = s.minutes * 60
      const tags = TAGS[s.type]
      let best: { id: string; score: number } | null = null
      for (const c of usable) {
        if (c.ftpTest || !c.tags.some((t) => tags.includes(t))) continue
        const diff = Math.abs(c.durationS - target)
        if (diff > target * TOLERANCE) continue
        const score = diff + (used.get(c.id) ?? 0) * REPEAT_PENALTY * target
        if (!best || score < best.score) best = { id: c.id, score }
      }
      if (!best) {
        unfilled.push({ week: wi, session: si })
        return null
      }
      used.set(best.id, (used.get(best.id) ?? 0) + 1)
      return best.id
    }),
  )
  return { picks, unfilled }
}

/**
 * When nothing of the right length fits and no AI can write one: the closest
 * workout of the kind whatever its length, else the closest endurance ride.
 */
export function closestAnyLength(session: SkeletonSession, library: readonly LibraryCandidate[]): string | null {
  const usable = library.filter((w) => !w.tags.includes('fun') && !w.ftpTest)
  const target = session.minutes * 60
  const closest = (tags: readonly string[]) =>
    usable.filter((c) => c.tags.some((t) => tags.includes(t))).sort((a, b) => Math.abs(a.durationS - target) - Math.abs(b.durationS - target))[0]?.id ?? null
  return closest(session.type === 'test' ? ['endurance'] : TAGS[session.type]) ?? closest(['endurance'])
}
