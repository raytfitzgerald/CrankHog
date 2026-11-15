import { Decoder, Stream } from '@garmin/fitsdk'
import { describe, expect, it } from 'vitest'
import { TrainerController } from '../control/trainer-controller'
import { SensorHub } from '../sensors/hub'
import { FakeClock } from '../time/clock'
import { MIN_RIDE_S, finalizeRide, fitFileName } from './finalize'
import { parseJournal } from './journal'
import { courseFromData } from '../journeys/course'
import { DEFAULT_BIKE, steadySpeedForPower } from '../physics/bike'
import { FlatRoadLayer } from './flat-road'
import { JourneyLayer, type PlanLayer } from '../journeys/layer'
import { encodePolyline } from '../journeys/polyline'
import type { RidePlan } from './plan'
import { RideSession, type JournalSink, type SessionEvent } from './session'

function memoryJournal(opts: { failFirstAppend?: boolean } = {}) {
  const files = new Map<string, string[]>()
  const seqs: number[] = []
  let failed = false
  const sink: JournalSink = {
    begin: async (id, meta) => {
      files.set(id, [meta])
    },
    append: async (id, seq, lines) => {
      if (opts.failFirstAppend && !failed) {
        failed = true
        throw new Error('disk full')
      }
      seqs.push(seq)
      files.get(id)!.push(...lines)
      return seq
    },
    close: async () => undefined,
  }
  return { sink, files, seqs }
}

function setup(opts: { autoPause?: boolean; plan?: RidePlan; layer?: PlanLayer; bests?: Record<number, number>; failFirstAppend?: boolean } = {}) {
  const clock = new FakeClock(Date.UTC(2026, 8, 29, 13, 0, 0))
  const hub = new SensorHub()
  const controller = new TrainerController()
  const journal = memoryJournal({ failFirstAppend: opts.failFirstAppend })
  let paused = false
  const session = new RideSession(
    { clock, hub, controller, journal: journal.sink, setPaused: (p) => (paused = p) },
    {
      rideId: 'ride-test-01',
      name: 'Test ride',
      kind: opts.plan?.kind ?? 'free',
      simulated: true,
      athlete: { ftpW: 250, weightKg: 75, lthr: 165 },
      autoPause: opts.autoPause ?? true,
      plan: opts.plan,
      ...(opts.layer ? { layer: opts.layer } : {}),
      bests: opts.bests,
    },
  )
  const events: SessionEvent[] = []
  session.on((e) => events.push(e))
  let t = 0
  /** Advance time feeding the hub at 4 Hz and ticking the session at 4 Hz. */
  const ride = async (
    seconds: number,
    power: number | null,
    cadence: number | null = power === null ? null : power > 0 ? 90 : 0,
    hr: number | null = 140,
    speed: number | null = null,
  ) => {
    const end = t + seconds * 1000
    while (t < end) {
      t += 250
      clock.advance(250)
      if (power !== null) hub.ingest({ metric: 'power', value: power, tMono: t, sourceId: 'trainer:ftms' })
      if (cadence !== null) hub.ingest({ metric: 'cadence', value: cadence, tMono: t, sourceId: 'trainer:ftms' })
      if (speed !== null) hub.ingest({ metric: 'speed', value: speed, tMono: t, sourceId: 'csc:wheel' })
      if (hr !== null && t % 1000 === 0) hub.ingest({ metric: 'hr', value: hr, tMono: t, sourceId: 'hr:hrs' })
      session.tick(t)
      await Promise.resolve()
    }
  }
  return { clock, hub, controller, session, journal, events, ride, isPaused: () => paused }
}

describe('RideSession', () => {
  it('records a free ride with a user pause and finalizes to a FIT with the pause taken out', async () => {
    const { session, ride, journal } = setup()
    session.start()
    await ride(600, 200)
    session.pause('user')
    await ride(60, 0)
    session.resume()
    await ride(300, 220)
    const { records } = await session.finish()

    expect(records.length).toBeGreaterThanOrEqual(899)
    expect(records.length).toBeLessThanOrEqual(901)
    // pause gap shows up in timestamps
    const gaps = records.slice(1).filter((r, i) => r.ts - records[i]!.ts > 1000)
    expect(gaps).toHaveLength(1)

    const j = parseJournal(journal.files.get('ride-test-01')!.join('\n'))
    expect(j.meta?.name).toBe('Test ride')
    expect(j.meta?.athlete?.lthr).toBe(165) // a recovered ride keeps its HR zones
    expect(j.records.length).toBe(records.length)
    expect(j.ended).toBe(true)

    const fin = finalizeRide({
      rideId: 'ride-test-01', name: 'Test ride', kind: 'free', simulated: true, startedAt: records[0]!.ts - 1000,
      athlete: { ftpW: 250, weightKg: 75, lthr: 165 }, records, utcOffsetMin: -420, softwareVersion: 10, now: Date.now(),
    })
    expect(fin.summary.movingS).toBe(records.length)
    // the 60 s pause isn't in the saved ride: elapsed is moving time
    expect(fin.summary.elapsedS).toBe(records.length)
    expect(fin.summary.startedAt).toBe(records[0]!.ts - 1000)
    expect(fin.summary.avgPower).toBeGreaterThan(200)
    expect(fin.summary.np).toBeGreaterThan(200)
    expect(fin.summary.tss).toBeGreaterThan(0)
    const dec = new Decoder(Stream.fromByteArray(Array.from(fin.fit!)))
    expect(dec.checkIntegrity()).toBe(true)
    const { messages } = dec.read()
    expect(messages.recordMesgs).toHaveLength(records.length)
    expect(messages.sessionMesgs![0]!.subSport).toBe('virtualActivity')
    expect(messages.eventMesgs!.filter((e) => e.event === 'timer').map((e) => e.eventType)).toEqual(['start', 'stopAll'])
    expect(messages.sessionMesgs![0]!.totalElapsedTime).toBe(records.length)
    expect(messages.sessionMesgs![0]!.totalTimerTime).toBe(records.length)
  })

  it('waits for the first pedal stroke before the clock starts', async () => {
    const plan: RidePlan = {
      kind: 'workout',
      name: 'Steady',
      tick: ({ movingS }) => ({
        desired: { mode: 'erg', watts: 180 }, targetW: 180, segmentIndex: 0, segmentLabel: 'Steady', segmentKind: 'steady',
        segmentRemainingS: 600 - movingS, segmentElapsedS: movingS, nextLabel: null, remainingS: 600 - movingS, finished: false,
      }),
    }
    const { session, ride, events, journal, controller, clock, isPaused } = setup({ plan })
    session.start()
    expect(session.currentState).toBe('waiting')
    // the trainer is told the first target, but holds the paused load until the first stroke
    expect(controller.snapshot.desired).toEqual({ mode: 'erg', watts: 180 })
    expect(isPaused()).toBe(true)
    await ride(25 * 60, 0, 0) // a long wait on the bike, not pedalling
    await ride(30, null, null, null) // and some with the trainer asleep
    expect(session.currentState).toBe('waiting')
    expect(session.records).toHaveLength(0)
    expect(session.snapshot()).toMatchObject({ state: 'waiting', elapsedS: 0, movingS: 0 })
    expect(session.planTick.remainingS).toBe(600)
    expect(journal.files.size).toBe(0)
    expect(events.some((e) => e.type === 'state' && e.state === 'paused')).toBe(false)

    const firstStroke = clock.wallMs() + 250
    await ride(120, 200)
    expect(session.currentState).toBe('riding')
    expect(isPaused()).toBe(false)
    const { records } = await session.finish()
    expect(records.length).toBeGreaterThanOrEqual(119)
    expect(records.every((r) => r.power === 200)).toBe(true)
    // the first second starts at the first stroke (record times are whole seconds)
    expect(Math.abs(records[0]!.ts - (firstStroke + 1000))).toBeLessThan(1000)
    const j = parseJournal(journal.files.get('ride-test-01')!.join('\n'))
    expect(j.meta?.startedAt).toBe(firstStroke)
    expect(session.snapshot().elapsedS).toBeLessThanOrEqual(121)
  })

  it('begins at once when the rider is already pedaling as they press start, without letting the trainer go', () => {
    const { session, hub, clock, isPaused } = setup()
    hub.ingest({ metric: 'power', value: 150, tMono: clock.now(), sourceId: 'trainer:ftms' })
    session.start()
    expect(session.currentState).toBe('riding')
    expect(isPaused()).toBe(false)
  })

  it('starts on a cadence reading alone, and whether or not auto-pause is on', async () => {
    const { session, ride, clock } = setup({ autoPause: false })
    session.start()
    await ride(10, 0, 0)
    expect(session.currentState).toBe('waiting')
    const firstStroke = clock.wallMs() + 250
    await ride(1.5, null, 60)
    expect(session.currentState).toBe('waiting')
    await ride(1, null, 60)
    expect(session.currentState).toBe('riding')
    // the two seconds it took to be sure are ridden: the clock started at the first stroke
    await ride(5, 150)
    const { records } = await session.finish()
    expect(records[0]!.ts).toBe(Math.round((firstStroke + 1000) / 1000) * 1000)
    expect(records[0]!.cadence).toBe(60)
  })

  it('keeps waiting through trainer noise and a foot on the pedal', async () => {
    const { session, ride, isPaused } = setup()
    session.start()
    await ride(20, 2, 0) // a trainer reading a couple of watts
    await ride(1, 150, 40) // stepping on the pedal
    await ride(5, 0, 0)
    await ride(1.5, 90, 30)
    await ride(20, null, null)
    expect(session.currentState).toBe('waiting')
    expect(session.records).toHaveLength(0)
    expect(isPaused()).toBe(true)
  })

  it('does not start on a value the hub is only holding after the trainer went quiet', async () => {
    const { session, ride, hub, clock } = setup()
    session.start()
    hub.ingest({ metric: 'power', value: 150, tMono: clock.now(), sourceId: 'trainer:ftms' })
    // the hub holds 150 W for its 3 s TTL, then has nothing: neither starts the clock
    await ride(10, null, null)
    expect(session.currentState).toBe('waiting')
  })

  it('ignores a lap pressed while waiting, and a skip there only moves where the ride begins', async () => {
    let offset = 0
    const plan: RidePlan = {
      kind: 'workout',
      name: 'Two blocks',
      tick: ({ movingS }) => {
        const seg = movingS + offset < 60 ? 0 : 1
        return {
          desired: { mode: 'erg', watts: seg === 0 ? 150 : 250 }, targetW: seg === 0 ? 150 : 250, segmentIndex: seg, segmentLabel: seg === 0 ? 'Easy' : 'Hard',
          segmentKind: 'steady', segmentRemainingS: null, segmentElapsedS: null, nextLabel: null, remainingS: 120 - movingS - offset, finished: false,
        }
      },
      command: (cmd, movingS) => {
        if (cmd.type !== 'skip') return false
        offset = 60 - movingS
        return true
      },
    }
    const { session, ride, journal, controller } = setup({ plan })
    session.start()
    await ride(10, 0, 0)
    session.command({ type: 'lap' })
    session.command({ type: 'skip' })
    expect(controller.snapshot.desired).toEqual({ mode: 'erg', watts: 250 })
    await ride(30, 0, 0)
    await ride(30, 250)
    const { records, events } = await session.finish()
    // one lap, all of it the Hard block: no 1-second lap 0 from the lap or the skip
    expect(new Set(records.map((r) => r.lap))).toEqual(new Set([0]))
    expect(records[0]!.targetW).toBe(250)
    // what happened while waiting is journaled as happening when the ride began, not before
    const j = parseJournal(journal.files.get('ride-test-01')!.join('\n'))
    expect(events.some((e) => e.type === 'event' && e.kind === 'lap')).toBe(false)
    expect(events.filter((e) => e.type === 'event' && e.kind !== 'segment')).toHaveLength(1) // the skip
    expect(events.every((e) => e.ts >= j.meta!.startedAt)).toBe(true)
    expect(j.events.filter((e) => e.type === 'event').every((e) => e.ts >= j.meta!.startedAt)).toBe(true)
  })

  it('starts a bike with only a speed sensor on its wheel, and auto-pauses and resumes by it', async () => {
    const { session, ride } = setup()
    session.start()
    await ride(10, null, null, 140, 0)
    expect(session.currentState).toBe('waiting')
    await ride(3, null, null, 140, 8)
    expect(session.currentState).toBe('riding')
    await ride(60, null, null, 140, 8) // no power and no cadence isn't a lost sensor here
    expect(session.currentState).toBe('riding')
    await ride(5, null, null, 140, 0)
    expect(session.currentState).toBe('paused')
    await ride(1, null, null, 140, 6)
    expect(session.currentState).toBe('riding')
  })

  it('keeps every second of a speed-and-HR ride started by hand, from the finish and from its journal', async () => {
    const { session, ride, journal } = setup()
    session.start()
    await ride(20, null, null, 95, 0) // standing over the bike
    session.command({ type: 'togglePause' }) // "Start now"
    await ride(20, null, null, 100, 0) // still getting on: auto-pause takes all but 3 s of it
    await ride(600, null, null, 140, 9)
    const { records } = await session.finish()
    expect(records.length).toBeGreaterThanOrEqual(602)
    expect(records.length).toBeGreaterThanOrEqual(MIN_RIDE_S)
    const save = (rs: typeof records) =>
      finalizeRide({
        rideId: 'ride-test-01', name: 'Test ride', kind: 'free', simulated: false, startedAt: rs[0]!.ts - 1000,
        athlete: { ftpW: 250, weightKg: 75 }, records: rs, utcOffsetMin: 0, softwareVersion: 10, now: Date.now(),
      }).summary
    // finishing saves it all
    expect(save(records)).toMatchObject({ movingS: records.length, elapsedS: records.length, avgPower: null, avgHr: 140 })
    // and so does recovering it from the journal after a crash
    const j = parseJournal(journal.files.get('ride-test-01')!.join('\n'))
    expect(j.records).toHaveLength(records.length)
    expect(save(j.records).movingS).toBe(records.length)
  })

  it('starts when the rider asks, for a bike with no power or cadence', async () => {
    const { session, ride } = setup()
    session.start()
    session.pause('system') // the Mac sleeping meanwhile changes nothing
    expect(session.currentState).toBe('waiting')
    session.command({ type: 'togglePause' })
    expect(session.currentState).toBe('riding')
    await ride(10, null, null, 140)
    expect(session.records.length).toBeGreaterThanOrEqual(9)
  })

  it('finishes a ride that never started without recording or journalling anything', async () => {
    const { session, ride, journal, events, isPaused } = setup()
    let closed = false
    journal.sink.close = async () => {
      closed = true
    }
    session.start()
    await ride(30, 0, 0)
    const { records, events: journalEvents } = await session.finish()
    expect(records).toEqual([])
    expect(journalEvents).toEqual([])
    expect(journal.files.size).toBe(0)
    expect(closed).toBe(false)
    expect(session.currentState).toBe('finished')
    expect(events.at(-1)).toEqual({ type: 'state', state: 'finished' })
    // the Just ride page carries on after it: its trainer mode isn't left at the paused load
    expect(isPaused()).toBe(false)
  })

  it('auto-pauses on real zeros (not on missing data) and resumes when pedalling', async () => {
    const { session, ride, events, isPaused } = setup()
    session.start()
    await ride(60, 200)
    await ride(5, 0, 0)
    expect(session.currentState).toBe('paused')
    expect(isPaused()).toBe(true)
    expect(events.some((e) => e.type === 'state' && e.state === 'paused' && e.reason === 'auto')).toBe(true)
    await ride(3, 180, 85)
    expect(session.currentState).toBe('riding')
  })

  it('pauses with sensor-lost after 30 s of total silence', async () => {
    const { session, ride, events } = setup()
    session.start()
    await ride(30, 200)
    await ride(40, null, null, null)
    expect(session.currentState).toBe('paused')
    expect(events.some((e) => e.type === 'state' && e.reason === 'sensor-lost')).toBe(true)
  })

  it('emits live PRs against previous bests', async () => {
    const { session, ride, events } = setup({ bests: { 60: 280, 5: 900 } })
    session.start()
    await ride(90, 310)
    const prs = events.filter((e) => e.type === 'pr')
    expect(prs.some((p) => p.type === 'pr' && p.durationS === 60 && p.watts >= 300)).toBe(true)
    expect(prs.some((p) => p.type === 'pr' && p.durationS === 5)).toBe(false)
    // Once per duration per ride, however long the effort keeps improving.
    expect(prs.filter((p) => p.type === 'pr' && p.durationS === 60)).toHaveLength(1)
  })

  it('announces no PRs without history (every effort would be one)', async () => {
    const { session, ride, events } = setup({ bests: {} })
    session.start()
    await ride(60, 150)
    await ride(120, 320)
    await session.finish()
    expect(events.filter((e) => e.type === 'pr')).toEqual([])
  })

  it('writes the last records and the end line before closing, even with an append in flight', async () => {
    const { session, ride, journal } = setup()
    const order: string[] = []
    let release: (() => void) | null = null
    const append = journal.sink.append
    journal.sink.append = async (id, seq, lines) => {
      // the first append after 5 s hangs until finish() has been called
      if (seq === 2) await new Promise<void>((r) => (release = r))
      order.push(`append ${seq}`)
      return append(id, seq, lines)
    }
    journal.sink.close = async () => {
      order.push('close')
    }
    session.start()
    await ride(10, 200)
    const finished = session.finish()
    ;(release as (() => void) | null)?.()
    await finished
    expect(order.at(-1)).toBe('close')
    expect(parseJournal(journal.files.get('ride-test-01')!.join('\n')).ended).toBe(true)
  })

  it('retries failed journal appends with the same sequence number', async () => {
    const { session, ride, journal } = setup({ failFirstAppend: true })
    session.start()
    await ride(5, 200)
    await session.finish()
    expect(journal.seqs[0]).toBe(1)
    const lines = journal.files.get('ride-test-01')!
    expect(parseJournal(lines.join('\n')).records.length).toBeGreaterThanOrEqual(4)
  })

  it('laps on plan segment changes and records the plan target', async () => {
    let seg = 0
    const plan: RidePlan = {
      kind: 'workout',
      name: 'Two blocks',
      tick: ({ movingS }) => {
        seg = movingS < 60 ? 0 : 1
        return {
          desired: { mode: 'erg', watts: seg === 0 ? 150 : 250 },
          targetW: seg === 0 ? 150 : 250,
          segmentIndex: seg,
          segmentLabel: seg === 0 ? 'Easy' : 'Hard',
          segmentKind: 'steady',
          segmentRemainingS: 60 - (movingS % 60),
          segmentElapsedS: movingS % 60,
          nextLabel: null,
          remainingS: 120 - movingS,
          finished: movingS >= 120,
        }
      },
    }
    const { session, ride, controller } = setup({ plan })
    session.start()
    await ride(125, 200)
    const { records } = await session.finish()
    expect(new Set(records.map((r) => r.lap))).toEqual(new Set([0, 1]))
    expect(records[10]!.targetW).toBe(150)
    expect(records[100]!.targetW).toBe(250)
    expect(controller.snapshot.desired).toEqual({ mode: 'idle' })
  })

  it('names FIT files by local start time', () => {
    expect(fitFileName({ startedAt: Date.UTC(2026, 8, 29, 13, 5), name: 'Sweet Spot' }, -420)).toBe('2026-09-29 0605 - Sweet Spot.fit')
    // a very long route name still makes a file name the IPC contract accepts
    expect(fitFileName({ startedAt: 0, name: 'x'.repeat(400) }).length).toBeLessThanOrEqual(200)
  })
})

describe('RideSession on a journey', () => {
  // 30 km due north from the Eiffel Tower, flat
  const pts: [number, number][] = Array.from({ length: 61 }, (_, i) => [48.8584 + (i * 500) / 111_195, 2.2945])
  const course = courseFromData({
    v: 1, id: 't', name: 'Test Road', kind: 'drop', blurb: '', start: 'Eiffel Tower', end: 'North', lengthM: 30_000, gainM: 0,
    line: encodePolyline(pts), ele: { stepM: 50, m: Array(601).fill(35) }, milestones: [{ m: 30_000, name: 'North', kind: 'finish' }],
  })

  it('records the virtual road: GPS on every record, and distance from the physics speed', async () => {
    const layer = new JourneyLayer({ course, journeyId: null, startM: 0, terrain: 'real', rider: { riderKg: 75 }, gps: true })
    const { session, ride, hub, clock } = setup({ layer })
    // already rolling, so the ride's seconds end where the layer's do
    hub.ingest({ metric: 'power', value: 200, tMono: clock.now(), sourceId: 'trainer:ftms' })
    session.start()
    await ride(300, 200)
    const { records } = await session.finish()
    expect(records.length).toBeGreaterThan(290)
    expect(records.every((r) => typeof r.lat === 'number' && typeof r.lon === 'number')).toBe(true)
    const last = records.at(-1)!
    expect(last.distance).toBeCloseTo(layer.riddenM, -1)
    expect(last.lat!).toBeGreaterThan(48.8584 + 1000 / 111_195)
    expect(last.speed!).toBeGreaterThan(8)
  })

  it('rolls on when the rider stops pedalling, and auto-pauses only once the dot has nearly stopped', async () => {
    const layer = new JourneyLayer({ course, journeyId: null, startM: 0, terrain: 'real', rider: { riderKg: 75 }, gps: true })
    const { session, ride } = setup({ layer })
    session.start()
    await ride(120, 250)
    await ride(30, 0, 0)
    expect(session.currentState).toBe('riding')
    expect(session.planTick.speed! * 3.6).toBeGreaterThan(15)
    await ride(180, 0, 0)
    expect(session.currentState).toBe('paused')
    expect(session.planTick.speed! * 3.6).toBeLessThan(3)
    expect(session.liveTick.speed).toBe(0)
  })
})

describe('RideSession on a flat road (a free ride or a workout with no journey)', () => {
  /** Five minutes at 200 W, with the trainer reporting `wheelMps` (null: no speed at all). */
  async function ride200(wheelMps: number | null, layer: PlanLayer | null = new FlatRoadLayer({ riderKg: 75 })) {
    const { session, ride } = setup(layer ? { layer } : {})
    session.start()
    await ride(300, 200, 90, 140, wheelMps)
    return (await session.finish()).records
  }

  it('saves the same distance for the same watts in any gear, and the FIT carries it', async () => {
    const smallGear = await ride200(25 / 3.6)
    const bigGear = await ride200(40 / 3.6)
    const last = bigGear.at(-1)!
    expect(last.distance).toBe(smallGear.at(-1)!.distance)
    expect(last.speed!).toBeCloseTo(steadySpeedForPower(200, 0, DEFAULT_BIKE), 2)
    expect(last.distance).toBeGreaterThan(2600)
    expect(last.distance).toBeLessThan(2800)
    // before, the trainer's flywheel speed set the distance: 2.1 km in the small gear, 3.3 km in the big one
    expect((await ride200(25 / 3.6, null)).at(-1)!.distance).toBeLessThan(2100)
    expect((await ride200(40 / 3.6, null)).at(-1)!.distance).toBeGreaterThan(3300)

    const fin = finalizeRide({
      rideId: 'ride-test-01', name: 'Test ride', kind: 'free', simulated: true, startedAt: bigGear[0]!.ts - 1000,
      athlete: { ftpW: 250, weightKg: 75 }, records: bigGear, utcOffsetMin: 0, softwareVersion: 10, now: Date.now(),
    })
    expect(fin.summary.distanceM).toBeCloseTo(last.distance, 0)
    const { messages } = new Decoder(Stream.fromByteArray(Array.from(fin.fit!))).read()
    expect(messages.sessionMesgs![0]!.totalDistance).toBeCloseTo(last.distance, 0)
    expect(messages.recordMesgs!.at(-1)!.enhancedSpeed).toBeCloseTo(last.speed!, 2)
  })

  it('saves distance from the watts when the trainer reports no speed at all', async () => {
    const records = await ride200(null)
    expect(records.every((r) => r.speed !== null)).toBe(true)
    expect(records.at(-1)!.distance).toBe((await ride200(25 / 3.6)).at(-1)!.distance)
    // before: no speed, so no distance
    expect((await ride200(null, null)).at(-1)!.distance).toBe(0)
  })

  it('keeps the wheel speed on a bike with no power', async () => {
    const { session, ride } = setup({ layer: new FlatRoadLayer() })
    session.start()
    await ride(120, null, null, 140, 8)
    const { records } = await session.finish()
    expect(records.length).toBeGreaterThan(110)
    expect(records.every((r) => r.speed === 8)).toBe(true)
    expect(records.at(-1)!.distance).toBe(records.length * 8)
  })

  it('still auto-pauses 3 s after the pedalling stops, and the screen shows the rider stopped', async () => {
    const { session, ride } = setup({ layer: new FlatRoadLayer() })
    session.start()
    await ride(60, 200)
    await ride(5, 0, 0)
    expect(session.currentState).toBe('paused')
    // the road speed the ride picks up again with, but standing still on screen
    expect(session.planTick.speed! * 3.6).toBeGreaterThan(25)
    expect(session.liveTick.speed).toBe(0)
    expect(session.liveTick).toBe(session.liveTick)
    await ride(3, 200)
    expect(session.currentState).toBe('riding')
    expect(session.liveTick).toBe(session.planTick)
    expect(session.liveTick.speed! * 3.6).toBeGreaterThan(25)
  })
})
