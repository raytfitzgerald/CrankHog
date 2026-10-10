import { describe, expect, it } from 'vitest'
import { FIRST_PASS_S, HOG, IDLE_QUIPS, NEXT_PASS_S, TRACK_QUIPS, TROT_QUIPS, hogLine, startHogSchedule, stepHogSchedule } from './hog'

// What he does on a route, and the lines that go with it, live in ./stunts.
const POOLS = { TRACK_QUIPS, TROT_QUIPS, IDLE_QUIPS }

describe('Sir Loin says', () => {
  it('names himself in every line that is a sentence about him', () => {
    for (const line of TROT_QUIPS) expect(line.endsWith('.'), line).toBe(true)
  })

  it('never jokes about a body, a weight or a health number', () => {
    // The personas have this rule (CLAUDE.md); the hog is held to it too.
    // "W/kg" is a power figure, not a body one, so it doesn't count.
    const banned = /\b(fat|thin|weight|(?<!W\/)kgs?|lbs?|pounds|diet|calorie|skinny|heavy|obese|belly|gut)\b/i
    for (const [pool, lines] of Object.entries(POOLS)) {
      for (const line of lines) expect(banned.test(line), `${pool}: ${line}`).toBe(false)
    }
  })

  it('keeps the interface voice: no emoji, no shouting', () => {
    for (const [pool, lines] of Object.entries(POOLS)) {
      for (const line of lines) {
        expect(line, `${pool}: ${line}`).not.toMatch(/\p{Extended_Pictographic}/u)
        expect(line, `${pool}: ${line}`).not.toMatch(/!/)
      }
    }
  })

  it('has no duplicates', () => {
    for (const [pool, lines] of Object.entries(POOLS)) {
      expect(new Set(lines).size, pool).toBe(lines.length)
    }
  })

  it('picks a line from the pool for any rng in [0, 1)', () => {
    for (const r of [0, 0.5, 0.999999]) expect(TRACK_QUIPS).toContain(hogLine(TRACK_QUIPS, () => r))
  })

  it('is called Sir Loin', () => {
    expect(HOG.name).toBe('Sir Loin')
    expect(TRACK_QUIPS.some((l) => l.includes(HOG.name))).toBe(true)
  })
})

describe('passing you on a route', () => {
  it('leaves it a few minutes before the first pass', () => {
    expect(startHogSchedule(() => 0).nextAtS).toBe(FIRST_PASS_S.min)
    expect(startHogSchedule(() => 0.999).nextAtS).toBeLessThanOrEqual(FIRST_PASS_S.max)
    expect(startHogSchedule(() => 0).passes).toBe(0)
  })

  it('holds still until the pass is due', () => {
    const s = startHogSchedule(() => 0)
    const { schedule, pass } = stepHogSchedule(s, FIRST_PASS_S.min - 1, () => 0)
    expect(pass).toBeNull()
    expect(schedule).toBe(s)
  })

  it('sends him through once the ride has got that far', () => {
    const s = startHogSchedule(() => 0)
    const { schedule, pass } = stepHogSchedule(s, FIRST_PASS_S.min, () => 0)
    expect(pass).not.toBeNull()
    expect(schedule.passes).toBe(1)
    expect(schedule.nextAtS).toBe(FIRST_PASS_S.min + NEXT_PASS_S.min)
  })

  it('only ever sends one through per step, however long the gap', () => {
    // a tab asleep for an hour must not release the whole herd at once
    const { schedule, pass } = stepHogSchedule(startHogSchedule(() => 0), 3600, () => 0)
    expect(pass!.id).toBe(1)
    expect(schedule.passes).toBe(1)
    expect(schedule.nextAtS).toBeGreaterThan(3600)
  })

  it('alternates sides, so two passes never lie on top of each other', () => {
    let s = startHogSchedule(() => 0)
    const lanes: string[] = []
    for (let t = 0; t < 4000 && lanes.length < 4; t += 10) {
      const r = stepHogSchedule(s, t, () => 0.5)
      s = r.schedule
      if (r.pass) lanes.push(r.pass.lane)
    }
    expect(lanes).toEqual(['far', 'near', 'far', 'near'])
  })

  it('keeps the gaps inside their range over a long ride', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      let s = startHogSchedule(() => r)
      let last = 0
      for (let t = 0; t < 7200; t += 5) {
        const step = stepHogSchedule(s, t, () => r)
        if (step.pass) {
          if (step.schedule.passes > 1) {
            const gap = t - last
            expect(gap).toBeGreaterThanOrEqual(NEXT_PASS_S.min - 5)
            expect(gap).toBeLessThanOrEqual(NEXT_PASS_S.max + 5)
          }
          last = t
        }
        s = step.schedule
      }
    }
  })
})
