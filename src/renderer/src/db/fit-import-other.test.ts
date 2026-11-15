import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DecodedFit } from '@core/fit/import'
import { db } from './db'
import { describeImport, importFitFiles } from './fit-import'

// The decoder is the fit-file-parser library; here each "file" decodes to what its name says.
const T0 = new Date(2026, 10, 14, 7, 0, 0).getTime()
const at = (s: number) => new Date(T0 + s * 1000)
const DECODED: Record<string, DecodedFit> = {
  'run.fit': {
    sessions: [{ sport: 'running', sub_sport: 'generic', total_training_effect: 3.1, total_anaerobic_training_effect: 0.8, training_load_peak: 72 }],
    records: Array.from({ length: 3600 }, (_, s) => ({ timestamp: at(s), heart_rate: 160, distance: s * 3 })),
  },
  'strength.fit': { sessions: [{ sport: 'training', sub_sport: 'strength_training' }], records: Array.from({ length: 1800 }, (_, s) => ({ timestamp: at(7200 + s) })) },
  // a day later: a triathlon, 20 min swim, a transition, 40 min bike, a transition, 20 min run
  'tri.fit': {
    sessions: [
      { sport: 'swimming', start_time: at(86_400) },
      { sport: 'transition', start_time: at(87_600) },
      { sport: 'cycling', sub_sport: 'road', start_time: at(87_720) },
      { sport: 'transition', start_time: at(90_120) },
      { sport: 'running', start_time: at(90_180) },
    ],
    records: Array.from({ length: 4980 }, (_, s) => ({ timestamp: at(86_400 + s), heart_rate: 150, ...(s >= 1320 && s < 3720 ? { power: 200, cadence: 85 } : {}) })),
  },
}
vi.mock('fit-file-parser', () => ({
  default: class {
    async parseAsync(ab: ArrayBuffer) {
      return DECODED[new TextDecoder().decode(ab)]
    }
  },
}))
const file = (name: string) => ({ name, bytes: new TextEncoder().encode(name) })

beforeEach(async () => {
  await db().delete()
  await db().open()
  // LTHR 160: an hour at 160 bpm is 100 hrTSS
  await db().profile.put({ from: 0, weightKg: 75, lthr: 160 })
})

describe('importFitFiles: other sports', () => {
  it('keeps a run or a strength session as an activity, with its hrTSS and Garmin’s numbers', async () => {
    const r = await importFitFiles([file('run.fit'), file('strength.fit')])
    expect(r.imported).toEqual([])
    expect(r.activities.map((a) => a.name)).toEqual(['Morning run', 'Morning strength'])
    const [run, strength] = await db().activities.orderBy('startedAt').toArray()
    expect(run).toMatchObject({ sport: 'running', movingS: 3600, avgHr: 160, hrLoad: 100, trainingEffect: { aerobic: 3.1, anaerobic: 0.8 }, garminLoad: 72, fileName: 'run.fit' })
    expect(strength).toMatchObject({ sport: 'training', subSport: 'strength_training', movingS: 1800, hrLoad: null })
    expect(await db().rides.count()).toBe(0)
  })

  it('skips an activity it already has', async () => {
    await importFitFiles([file('run.fit')])
    const again = await importFitFiles([file('run.fit')])
    expect(again.activities).toEqual([])
    expect(again.skipped[0]!.reason).toMatch(/Already/)
    expect(await db().activities.count()).toBe(1)
  })
})

describe('importFitFiles: a multisport file', () => {
  it('brings in a triathlon as a swim, a ride and a run, not one swim the length of the race', async () => {
    const r = await importFitFiles([file('tri.fit')])
    expect(r.imported).toHaveLength(1)
    expect((await db().rides.toArray()).map((x) => x.movingS)).toEqual([2400])
    expect((await db().activities.orderBy('startedAt').toArray()).map((a) => [a.sport, a.movingS])).toEqual([
      ['swimming', 1200],
      ['running', 1200],
    ])
    expect(r.skipped).toEqual([])
  })
})

describe('describeImport', () => {
  it('names what came in, leaving out what did not', () => {
    const item = { name: 'x', rideId: 'r', id: 'a' }
    expect(describeImport({ imported: [item, item], activities: [] })).toBe('2 rides')
    expect(describeImport({ imported: [], activities: [item] })).toBe('1 other activity')
    expect(describeImport({ imported: [item], activities: [item, item] })).toBe('1 ride and 2 other activities')
    expect(describeImport({ imported: [], activities: [] })).toBe('0 rides')
  })
})
