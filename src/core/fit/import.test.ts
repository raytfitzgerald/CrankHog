import FitParser from 'fit-file-parser'
import { describe, expect, it } from 'vitest'
import { finalizeRide } from '../ride/finalize'
import type { RideRecord } from '../ride/recorder'
import { FitImportError, importFitActivity, importOtherActivity, splitMultisport, type DecodedFit, type DecodedRecord } from './import'

const T0 = Date.UTC(2026, 8, 20, 6, 30, 0)

const rec = (t: number, over: Partial<RideRecord> = {}): RideRecord => ({
  t,
  ts: T0 + (t + 1) * 1000,
  power: 200 + (t % 7),
  cadence: 88,
  hr: 130 + (t % 3),
  speed: 9.5,
  distance: t * 9.5,
  altitude: 120 + t * 0.05,
  grade: 1.5,
  targetW: 205,
  lrBalance: 48,
  coreTemp: 37.6,
  skinTemp: null,
  smo2: null,
  lap: t < 90 ? 0 : 1,
  rr: [],
  ...over,
})

async function decode(bytes: Uint8Array): Promise<DecodedFit> {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return (await new FitParser({ mode: 'list', force: true }).parseAsync(ab)) as unknown as DecodedFit
}

const at = (s: number) => new Date(T0 + s * 1000)

describe('importFitActivity', () => {
  it('round-trips a CrankHog FIT file second for second', async () => {
    const records = Array.from({ length: 180 }, (_, t) => rec(t, t === 40 ? { power: null, hr: null } : {}))
    const fin = finalizeRide({ rideId: 'r-rt', name: 'Round trip', kind: 'free', simulated: false, startedAt: T0, athlete: { ftpW: 250, weightKg: 75 }, records, utcOffsetMin: 0, softwareVersion: 10, now: T0 + 400_000 })
    const imp = importFitActivity(await decode(fin.fit!))
    expect(imp.fromCrankHog).toBe(true)
    expect(imp.startedAt).toBe(T0)
    expect(imp.records).toHaveLength(180)
    for (const k of ['power', 'hr', 'cadence', 'targetW', 'lrBalance', 'lap'] as const) {
      expect(imp.records.map((r) => r[k])).toEqual(records.map((r) => r[k]))
    }
    expect(imp.records.map((r) => r.ts)).toEqual(records.map((r) => r.ts))
    expect(imp.records[100]!.distance).toBeCloseTo(950, 1)
    expect(imp.records[100]!.speed).toBeCloseTo(9.5, 2)
    expect(imp.records[100]!.altitude).toBeCloseTo(125, 0)
    expect(imp.records[100]!.coreTemp).toBeCloseTo(37.6, 1)
  })

  it('holds values across smart-recording gaps but not across pauses or long gaps', () => {
    const r = (s: number, power: number): DecodedRecord => ({ timestamp: at(s), power, heart_rate: 140, cadence: 90, distance: s * 8 })
    const fit: DecodedFit = {
      sessions: [{ sport: 'cycling', sub_sport: 'road' }],
      // every 3 s for 2 min, a timer pause 120→300, then 1 Hz, then a silent 60 s hole
      records: [
        ...Array.from({ length: 41 }, (_, i) => r(i * 3, 200 + i)),
        ...Array.from({ length: 60 }, (_, i) => r(300 + i, 250)),
        ...Array.from({ length: 30 }, (_, i) => r(420 + i, 180)),
      ],
      events: [
        { event: 'timer', event_type: 'start', timestamp: at(0) },
        { event: 'timer', event_type: 'stop_all', timestamp: at(121) },
        { event: 'timer', event_type: 'start', timestamp: at(300) },
      ],
    }
    const imp = importFitActivity(fit)
    expect(imp.records).toHaveLength(121 + 60 + 30)
    expect(imp.records.slice(0, 4).map((x) => x.power)).toEqual([200, 200, 200, 201])
    expect(imp.records[120]!.ts).toBe(T0 + 120_000)
    expect(imp.records[121]!.ts).toBe(T0 + 300_000) // the pause is not filled
    expect(imp.records[181]!.ts).toBe(T0 + 420_000) // neither is a 60-s hole
    expect(imp.records.map((x) => x.t)).toEqual(imp.records.map((_, i) => i))
    expect(imp.indoor).toBe(false)
  })

  it('keeps missing fields null, decodes L/R balance and follows laps', () => {
    const fit: DecodedFit = {
      sessions: [{ sport: 'cycling', sub_sport: 'indoor_cycling', total_ascent: 0 }],
      records: Array.from({ length: 70 }, (_, s) => ({
        timestamp: at(s),
        power: s < 10 ? undefined : 150,
        left_right_balance: s % 3 === 0 ? { value: 52, right: true } : s % 3 === 1 ? 0x80 | 55 : { value: 47 },
      })),
      laps: [{ start_time: at(0) }, { start_time: at(30) }],
    }
    const imp = importFitActivity(fit)
    expect(imp.records[0]).toMatchObject({ power: null, hr: null, cadence: null, altitude: null, lrBalance: 48 })
    expect(imp.records[1]!.lrBalance).toBe(45)
    expect(imp.records[2]!.lrBalance).toBe(47) // side unknown: taken as left
    // Lap 2 starts at 30 s: the record stamped 30 covers (29, 30] and is still lap 1.
    expect(imp.records[30]!.lap).toBe(0)
    expect(imp.records[31]!.lap).toBe(1)
    expect(imp.indoor).toBe(true)
    expect(imp.elevationGainM).toBe(0)
  })

  it('refuses runs, empty files and scraps under a minute', () => {
    expect(() => importFitActivity({ sessions: [{ sport: 'running' }], records: [{ timestamp: at(0) }] })).toThrow(FitImportError)
    expect(() => importFitActivity({ sessions: [{ sport: 'running' }] })).toThrow(/running activity, not a ride/)
    expect(() => importFitActivity({ sessions: [{ sport: 'cycling' }], records: [] })).toThrow(/no recorded data/)
    expect(() => importFitActivity({ records: Array.from({ length: 20 }, (_, s) => ({ timestamp: at(s), power: 100 })) })).toThrow(/Less than a minute/)
  })
})

describe('importOtherActivity', () => {
  const run = (over: Partial<NonNullable<DecodedFit['sessions']>[number]> = {}): DecodedFit => ({
    file_ids: [{ manufacturer: 'garmin', garmin_product: 'fr965' }],
    sessions: [{ sport: 'running', sub_sport: 'generic', total_training_effect: 3.2, total_anaerobic_training_effect: 1.4, training_load_peak: 87.5, ...over }],
    // 30 min at 1 Hz, with a timer pause from 600 to 900 that is not filled
    records: [
      ...Array.from({ length: 600 }, (_, s) => ({ timestamp: at(s), heart_rate: 150, distance: s * 3 })),
      ...Array.from({ length: 1200 }, (_, s) => ({ timestamp: at(900 + s), heart_rate: 160, distance: 1800 + s * 3 })),
    ],
    events: [
      { event: 'timer', event_type: 'start', timestamp: at(0) },
      { event: 'timer', event_type: 'stop_all', timestamp: at(601) },
      { event: 'timer', event_type: 'start', timestamp: at(900) },
    ],
  })

  it('reads a run: sport, moving time, distance, heart rate, and Garmin’s Training Effect and load', () => {
    const a = importOtherActivity(run())
    expect(a).toMatchObject({
      sport: 'running',
      subSport: 'generic',
      // like a ride: the first record marks the end of the first moving second
      startedAt: T0 - 1000,
      movingS: 1800,
      distanceM: 1800 + 1199 * 3,
      avgHr: 157,
      maxHr: 160,
      trainingEffect: { aerobic: 3.2, anaerobic: 1.4 },
      garminLoad: 87.5,
      device: 'garmin fr965',
    })
    expect(a.hr).toHaveLength(1800)
  })

  it('leaves out what the file does not carry: missing is not zero', () => {
    const a = importOtherActivity(run({ total_training_effect: undefined, total_anaerobic_training_effect: undefined, training_load_peak: undefined }))
    expect(a.trainingEffect).toBeNull()
    expect(a.garminLoad).toBeNull()
    const noHr = importOtherActivity({ sessions: [{ sport: 'training', sub_sport: 'strength_training' }], records: Array.from({ length: 900 }, (_, s) => ({ timestamp: at(s) })) })
    expect(noHr).toMatchObject({ sport: 'training', subSport: 'strength_training', movingS: 900, avgHr: null, maxHr: null, distanceM: null })
  })

  it('falls back to the session’s own totals when the file has no records', () => {
    const a = importOtherActivity({ sessions: [{ sport: 'swimming', start_time: at(0), total_timer_time: 2400.4, total_distance: 2000, avg_heart_rate: 128, max_heart_rate: 151 }] })
    expect(a).toMatchObject({ sport: 'swimming', startedAt: T0, movingS: 2400, distanceM: 2000, avgHr: 128, maxHr: 151, hr: [] })
  })

  it('refuses a file with nothing in it', () => {
    expect(() => importOtherActivity({ sessions: [{ sport: 'running' }] })).toThrow(FitImportError)
  })
})

describe('splitMultisport', () => {
  // a sprint triathlon: 20 min swim, 2 min transition, 40 min bike, 1 min transition, 20 min run
  const legs: [string, number, number][] = [
    ['swimming', 0, 1200],
    ['transition', 1200, 120],
    ['cycling', 1320, 2400],
    ['transition', 3720, 60],
    ['running', 3780, 1200],
  ]
  const tri: DecodedFit = {
    sessions: legs.map(([sport, start]) => ({ sport, start_time: at(start) })),
    records: Array.from({ length: 4980 }, (_, s) => ({ timestamp: at(s), heart_rate: 150 })),
    laps: legs.map(([, start]) => ({ start_time: at(start) })),
  }

  it('makes one activity of each leg, with its own records and laps, leaving the transitions out', () => {
    const parts = splitMultisport(tri)
    expect(parts.map((p) => [p.sessions![0]!.sport, p.records!.length, p.laps!.length])).toEqual([
      ['swimming', 1200, 1],
      ['cycling', 2400, 1],
      ['running', 1200, 1],
    ])
    expect(importFitActivity(parts[1]!).records).toHaveLength(2400)
    expect(importOtherActivity(parts[2]!)).toMatchObject({ sport: 'running', movingS: 1200 })
  })

  it('leaves a file with one session, or sessions without start times, whole', () => {
    const one: DecodedFit = { sessions: [{ sport: 'cycling' }], records: [] }
    expect(splitMultisport(one)).toEqual([one])
    const undated: DecodedFit = { sessions: [{ sport: 'swimming' }, { sport: 'running' }] }
    expect(splitMultisport(undated)).toEqual([undated])
  })
})
