import { describe, expect, it } from 'vitest'
import { SESSION_EXAMPLES } from './examples'
import { formatSections, formatStep, isSessionFile, parseLength, parseSession } from './parse'

const example = (i: number) => SESSION_EXAMPLES[i]!
const parse = (text: string, fileName = 'x.txt') => parseSession(fileName, text)
const messages = (text: string) => {
  const p = parse(text)
  return { errors: p.errors.map((e) => `${e.line ? `line ${e.line}: ` : ''}${e.text}`), warnings: p.warnings.map((w) => `${w.line ? `line ${w.line}: ` : ''}${w.text}`) }
}

describe('the guide examples', () => {
  it('reads the threshold run: name, day, a warmup, a 4x main set and a cooldown', () => {
    const p = parseSession(example(0).fileName, example(0).text)
    expect(p.errors).toEqual([])
    expect(p.warnings).toEqual([])
    expect([p.header.sport, p.name, p.date]).toEqual(['run', 'Threshold 4x8', '2026-12-02'])
    expect(p.sections.map((s) => [s.title, s.repeat, s.steps.length])).toEqual([
      ['Warmup', 1, 1],
      ['Main set', 4, 2],
      ['Cooldown', 1, 1],
    ])
    expect(p.sections[1]!.steps[0]).toEqual({ line: 8, durationS: 480, target: { kind: 'pace', low: 250, high: 260, per: 'km' } })
    expect(p.sections[0]!.steps[0]!.target).toEqual({ kind: 'hrZone', zone: 2 })
  })

  it('reads the swim: pool, distances in metres, drills, rests and a pace per 100 m', () => {
    const p = parseSession(example(1).fileName, example(1).text)
    expect(p.errors).toEqual([])
    expect(p.warnings).toEqual([])
    expect(p.header.pool).toBe('25m')
    expect(p.sections[0]!.steps[0]).toEqual({ line: 6, distanceM: 400, distanceUnit: 'mtr', note: 'easy' })
    expect(p.sections[1]).toEqual({ title: 'Drills', repeat: 4, steps: [{ line: 9, distanceM: 50, distanceUnit: 'mtr', note: 'drill' }, { line: 10, durationS: 15, rest: true }] })
    expect(p.sections[2]!.steps[0]!.target).toEqual({ kind: 'pace', low: 100, high: 100, per: '100m' })
  })

  it('reads the squash game and the easy run, which have no steps', () => {
    const squash = parseSession(example(2).fileName, example(2).text)
    expect([squash.errors, squash.header.sport, squash.header.durationS, squash.header.effort, squash.date]).toEqual([[], 'other', 3600, 'hard', '2026-12-04'])
    const easy = parseSession(example(3).fileName, example(3).text)
    expect([easy.errors, easy.header.distanceM, easy.date, easy.name]).toEqual([[], 8000, null, 'Easy 8k'])
  })

  it('keeps what follows the header as the body to send to intervals.icu', () => {
    expect(parseSession(example(0).fileName, example(0).text).body.split('\n')[0]).toBe('Warmup')
  })
})

describe('isSessionFile', () => {
  it('is a session file when the header names a sport, and a bike workout otherwise', () => {
    expect(isSessionFile(example(1).text)).toBe(true)
    expect(isSessionFile('name: x\nsport: run\n\n- 10m Z2 HR')).toBe(true)
    expect(isSessionFile('- 10m 60%\n- 20m 90%')).toBe(false)
    expect(isSessionFile('Warmup\n- 10m 60%')).toBe(false)
    expect(isSessionFile('')).toBe(false)
  })
})

describe('lengths', () => {
  it('reads m as minutes and mtr as metres', () => {
    expect(parseLength('10m')).toEqual({ durationS: 600 })
    expect(parseLength('1h20m')).toEqual({ durationS: 4800 })
    expect(parseLength('5m30s')).toEqual({ durationS: 330 })
    expect(parseLength('400mtr')).toEqual({ distanceM: 400, distanceUnit: 'mtr' })
    expect(parseLength('1.5km')).toEqual({ distanceM: 1500, distanceUnit: 'km' })
    expect(parseLength('1mi')).toEqual({ distanceM: 1609.344, distanceUnit: 'mi' })
    expect(parseLength('100y')).toEqual({ distanceM: 91.44, distanceUnit: 'y' })
    expect(parseLength('100yd')).toEqual({ distanceM: 91.44, distanceUnit: 'y' })
    expect(parseLength('fast')).toBeNull()
  })
})

describe('the report messages', () => {
  it('warns that 400m is 400 minutes', () => {
    expect(messages('sport: run\n\n- 10m Z2 HR\n- 400m 4:00/km Pace').warnings).toEqual(['line 4: "400m" is 400 minutes. For metres write 400mtr.'])
  })

  it('warns about every length written in minutes in a swim, where 50m is surely meant as metres', () => {
    expect(messages('sport: swim\n\nMain 4x\n- 50m drill\n- 15s rest').warnings).toEqual(['line 4: "50m" is 50 minutes. For metres write 50mtr.'])
    // a run's 10m is ten minutes, as meant
    expect(messages('sport: run\n\n- 10m Z2 HR').warnings).toEqual([])
  })

  it('reads a distance header written in metres with m', () => {
    const p = parse('sport: run\ndistance: 5000m\neffort: easy')
    expect(p.errors).toEqual([])
    expect(p.header.distanceM).toBe(5000)
    expect(parse('sport: run\ndistance: 5 km').header.distanceM).toBe(5000)
  })

  it('refuses a sport it doesn’t know, and a ride', () => {
    expect(messages('name: x\nsport: tennis\n\n- 10m').errors).toEqual(['line 2: sport must be run, swim or other.'])
    expect(messages('sport: ride\n\n- 10m').errors[0]).toMatch(/A bike workout has no sport line/)
  })

  it('refuses a repeat inside a repeat', () => {
    expect(messages('sport: swim\n\nMain 3x\n- 100mtr 1:40/100m Pace\n2x\n- 50mtr easy').errors).toEqual(["line 5: a repeat inside a repeat isn't supported. Write the inner set out, or leave a blank line before a new set."])
  })

  it('refuses two targets on one step', () => {
    expect(messages('sport: run\n\n- 10m Z2 HR 4:30/km Pace').errors).toEqual(['line 3: one target per step. "Z2 HR 4:30/km Pace" has two.'])
  })

  it('wants steps or a duration or distance', () => {
    expect(messages('sport: other\nname: Squash').errors).toEqual(['No steps, and no duration or distance: add "duration: 45m" or some steps.'])
  })

  it('warns about a distance that isn’t whole lengths of the pool', () => {
    expect(messages('sport: swim\npool: 25m\n\n- 175mtr easy\n- 160mtr easy').warnings).toEqual(["line 5: distance 160mtr isn't a whole number of 25m lengths."])
  })

  it('names a distance in that warning the way it was written', () => {
    expect(messages('sport: swim\npool: 25m\n\n- 100y easy').warnings).toEqual(["line 4: distance 100y isn't a whole number of 25m lengths."])
  })

  it('wants a step to start with a length, a percent to say what of, and a zone to say which', () => {
    const { errors } = messages('sport: run\n\n- Z2 HR\n- 10m 80%\n- 5m Z3')
    expect(errors[0]).toMatch(/^line 3: a step starts with its length/)
    expect(errors[1]).toBe('line 4: say what "80%" is a percent of: "80% Pace" (threshold pace) or "80% LTHR" (threshold heart rate).')
    expect(errors[2]).toBe('line 5: say which zone "Z3" is: "Z3 HR" or "Z3 Pace".')
  })

  it('warns about headers it doesn’t know, and ones the steps make pointless', () => {
    const { warnings } = messages('sport: run\ncolour: red\nduration: 45m\n\n- 10m Z2 HR')
    expect(warnings[0]).toMatch(/^line 2: "colour" isn't a header CrankHog knows/)
    expect(warnings[1]).toBe('line 3: duration is ignored: the steps set the time.')
  })

  it('checks header values', () => {
    const { errors } = messages('sport: swim\ndate: 2026-02-30\npool: 33m\neffort: brutal\nduration: soon\ndistance: 8\n\n- 100mtr easy')
    expect(errors).toEqual([
      'line 2: date must be a real day written YYYY-MM-DD, like 2026-12-02.',
      'line 3: pool must be 25m, 50m or 25y.',
      'line 4: effort must be easy, moderate, hard or max.',
      'line 5: duration must be a time, like 45m, 1h or 1h15m.',
      'line 6: distance must have a unit, like 8km, 5mi, 2000mtr or 1650y.',
    ])
  })

  it('takes the date from the header over the file name', () => {
    expect(parseSession('2026-12-02_Run.txt', 'sport: run\ndate: 2026-12-09\n\n- 30m Z2 HR').date).toBe('2026-12-09')
  })

  it('accepts pace without the Pace keyword, and reads bpm ranges', () => {
    const p = parse('sport: run\n\n- 1km 4:00/km\n- 10m 140-150bpm')
    expect(p.errors).toEqual([])
    expect(p.sections[0]!.steps.map((s) => s.target)).toEqual([
      { kind: 'pace', low: 240, high: 240, per: 'km' },
      { kind: 'bpm', low: 140, high: 150 },
    ])
  })
})

describe('formatSections', () => {
  it('writes the steps back so they read the same', () => {
    for (const ex of SESSION_EXAMPLES.slice(0, 2)) {
      const p = parseSession(ex.fileName, ex.text)
      const again = parseSession(ex.fileName, `sport: ${p.header.sport}\n\n${formatSections(p.sections)}`)
      expect(again.errors).toEqual([])
      expect(again.sections.map((s) => ({ ...s, steps: s.steps.map(({ line: _l, ...rest }) => rest) }))).toEqual(p.sections.map((s) => ({ ...s, steps: s.steps.map(({ line: _l, ...rest }) => rest) })))
    }
  })
})

// The swim from the 1.3.0 screenshots: 300 + 4 × 50 + 8 × 100 + 200 = 1,500 yd.
const CSS_YARDS = `sport: swim
name: CSS 8x100
pool: 25y

Warm-up
- 300y easy

Drills 4x
- 50y drill
- 15s rest

Main set 8x
- 100y 100% Pace
- 15s rest

Cool-down
- 200y easy
`

describe('formatStep', () => {
  const shown = (text: string) => parse(text).sections.flatMap((s) => s.steps.map((st) => formatStep(st).replace(/^- /, '')))

  it('shows yards as yards, not as metres', () => {
    const steps = ['300y easy', '50y drill', '15s rest', '100y 100% Pace', '15s rest', '200y easy']
    expect(shown(CSS_YARDS)).toEqual(steps)
    // with no pool line too
    expect(shown(CSS_YARDS.replace('pool: 25y\n', ''))).toEqual(steps)
    expect(shown('sport: swim\n\n- 100yd easy')).toEqual(['100y easy'])
  })

  it('keeps every distance in the unit it was written in', () => {
    expect(shown('sport: run\n\n- 1mi 7:00/mi Pace\n- 1.5km easy\n- 2000mtr easy\n- 400mtr easy')).toEqual(['1mi 7:00/mi Pace', '1.5km easy', '2000mtr easy', '400mtr easy'])
    expect(shown('sport: swim\npool: 25m\n\n- 100y easy\n- 12.5y kick')).toEqual(['100y easy', '12.5y kick'])
  })

  it('reads every distance back the same, in yards too', () => {
    const p = parse(CSS_YARDS)
    const again = parse(`sport: swim\n\n${formatSections(p.sections)}`)
    const bare = (ss: typeof p.sections) => ss.map((s) => ({ ...s, steps: s.steps.map(({ line: _l, ...rest }) => rest) }))
    expect(bare(again.sections)).toEqual(bare(p.sections))
  })
})
