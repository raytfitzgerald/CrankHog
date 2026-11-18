import { describe, expect, it } from 'vitest'
import { DESCRIPTION_STATS, rideName, statsText, uploadDescription, type RideNumbers } from './upload-text'

const NUMBERS: RideNumbers = { avgPower: 204.6, np: 210, maxPower: 612, avgHr: 142, maxHr: 171, avgCadence: 88.4, kj: 812.4, tss: 64.6, intensityFactor: 0.824 }
const TEXT = 'Cranked hog with CrankHog\n{stats}\nCrankHog.app'

describe('upload description', () => {
  it('fills in the ticked numbers', () => {
    expect(uploadDescription({ text: TEXT, stats: ['avgPower', 'avgHr', 'kj'], numbers: NUMBERS })).toBe(
      'Cranked hog with CrankHog\nAvg power 205 W · Avg HR 142 bpm · Total output 812 kJ\nCrankHog.app',
    )
  })

  it('keeps its own order, whatever order they were ticked in', () => {
    expect(statsText(NUMBERS, ['kj', 'if', 'avgPower'])).toBe('Avg power 205 W · Total output 812 kJ · IF 0.82')
  })

  it('formats every number', () => {
    expect(statsText(NUMBERS, DESCRIPTION_STATS.map((s) => s.id))).toBe(
      'Avg power 205 W · NP 210 W · Max power 612 W · Avg HR 142 bpm · Max HR 171 bpm · Avg cadence 88 rpm · Total output 812 kJ · TSS 65 · IF 0.82',
    )
  })

  it('leaves out what the ride has none of', () => {
    const noStrap = { ...NUMBERS, avgHr: null, maxHr: null }
    expect(statsText(noStrap, ['avgPower', 'avgHr', 'kj'])).toBe('Avg power 205 W · Total output 812 kJ')
  })

  it('drops the numbers line when nothing is ticked, and tidies a one-line description', () => {
    expect(uploadDescription({ text: TEXT, stats: [], numbers: NUMBERS })).toBe('Cranked hog with CrankHog\nCrankHog.app')
    expect(uploadDescription({ text: 'Cranked hog · {stats} · CrankHog.app', stats: [], numbers: NUMBERS })).toBe('Cranked hog · CrankHog.app')
    expect(uploadDescription({ text: 'Cranked hog · {stats} · CrankHog.app', stats: ['tss'], numbers: NUMBERS })).toBe('Cranked hog · TSS 65 · CrankHog.app')
  })

  it("keeps the rider's own text as written, blank lines included", () => {
    expect(uploadDescription({ text: 'Suffered in the shed.\n\nNo regrets.', stats: ['kj'], numbers: NUMBERS })).toBe('Suffered in the shed.\n\nNo regrets.')
  })

  it("puts a journey's line just above crankhog.app", () => {
    expect(uploadDescription({ text: TEXT, stats: ['kj'], numbers: NUMBERS, extra: 'Day 3 of the Tour' }).split('\n')).toEqual([
      'Cranked hog with CrankHog',
      'Total output 812 kJ',
      'Day 3 of the Tour',
      'CrankHog.app',
    ])
    // the rider's own sign-off, in any case, with more on the line
    expect(uploadDescription({ text: 'Shed session\nMore at crankhog.APP, honestly', stats: [], numbers: NUMBERS, extra: 'Day 3' }).split('\n')).toEqual([
      'Shed session',
      'Day 3',
      'More at crankhog.APP, honestly',
    ])
  })

  it("puts a journey's line last when there's no crankhog.app, and alone when the rest is empty", () => {
    expect(uploadDescription({ text: 'Suffered.\n{stats}', stats: ['kj'], numbers: NUMBERS, extra: 'Day 3' })).toBe('Suffered.\nTotal output 812 kJ\nDay 3')
    expect(uploadDescription({ text: '  \n', stats: ['kj'], numbers: NUMBERS, extra: 'Day 3' })).toBe('Day 3')
  })

  it('is empty when the rider clears it', () => {
    expect(uploadDescription({ text: '  \n', stats: ['kj'], numbers: NUMBERS })).toBe('')
    expect(uploadDescription({ text: '{stats}', stats: [], numbers: NUMBERS })).toBe('')
  })
})

describe('ride name', () => {
  it('adds the journey to a free ride only', () => {
    expect(rideName({ name: 'Free ride', kind: 'free', journeyTitle: 'Tour de France, day 3' })).toBe('Free ride · Tour de France, day 3')
    expect(rideName({ name: 'Sweet spot 3x12', kind: 'workout', journeyTitle: 'Tour de France, day 3' })).toBe('Sweet spot 3x12')
    expect(rideName({ name: 'FTP test', kind: 'ftp-test', journeyTitle: 'Tour de France, day 3' })).toBe('FTP test')
    expect(rideName({ name: 'Free ride', kind: 'free' })).toBe('Free ride')
  })
})
