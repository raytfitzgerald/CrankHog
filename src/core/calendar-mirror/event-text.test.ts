import { describe, expect, it } from 'vitest'
import { clip, MIRROR_FOOTER, mirrorEvent, plainDuration } from './event-text'

describe('plainDuration', () => {
  it('reads as hours and minutes', () => {
    expect(plainDuration(2700)).toBe('45 min')
    expect(plainDuration(3600)).toBe('1 h')
    expect(plainDuration(4500)).toBe('1 h 15 min')
  })
})

describe('mirrorEvent', () => {
  it('describes a bike workout by its length and TSS, then its notes', () => {
    const e = mirrorEvent({ id: 's1', date: '2026-11-18', name: 'Sweet spot 3×12', sport: 'ride', durationS: 3600, tss: 71.6, notes: 'Hold it steady.' }, 'metric')
    expect(e).toEqual({ key: 's1', date: '2026-11-18', title: 'Sweet spot 3×12', description: `Ride · 1 h · TSS 72\n\nHold it steady.\n\n${MIRROR_FOOTER}` })
  })

  it('describes a session by its label, distance, effort and load, in the rider’s units', () => {
    const e = mirrorEvent({ id: 's2', date: '2026-11-19', name: 'Long run', sport: 'run', label: 'Trail', durationS: 5400, distanceM: 16_093, effort: 'easy', load: 60 }, 'imperial')
    expect(e.description.split('\n\n')[0]).toBe('Run: Trail · 1 h 30 min · 10 mi · Easy · Load 60')
  })

  it('leaves out what it doesn’t know, and never sends an empty title', () => {
    const e = mirrorEvent({ id: 's3', date: '2026-11-20', name: '  ', sport: 'other' }, 'metric')
    expect(e.title).toBe('Other')
    expect(e.description).toBe(`Other\n\n${MIRROR_FOOTER}`)
  })

  it('has no emoji and no exclamation marks of its own', () => {
    const e = mirrorEvent({ id: 's4', date: '2026-11-20', name: 'Swim', sport: 'swim', distanceM: 1500 }, 'metric')
    expect(e.description).not.toMatch(/[!\u{1F300}-\u{1FAFF}]/u)
  })

  it('gives swims in metres or yards, the way the calendar does', () => {
    const swim = (units: 'metric' | 'imperial') => mirrorEvent({ id: 's5', date: '2026-11-21', name: 'Swim', sport: 'swim', distanceM: 1800 }, units).description.split('\n\n')[0]
    expect(swim('metric')).toBe('Swim · 1,800 m')
    expect(swim('imperial')).toBe('Swim · 1,969 yd')
  })

  it('puts a session’s steps between the summary and the notes, line for line', () => {
    const steps = 'Warmup\n- 15m Z2 HR\n\nMain set 4x\n- 8m 4:10-4:20/km Pace\n- 2m Z1 HR'
    const e = mirrorEvent({ id: 's6', date: '2026-11-22', name: 'Threshold 4x8', sport: 'run', durationS: 4200, steps: `\n${steps}\n`, notes: 'Flat route.' }, 'metric')
    expect(e.description).toBe(`Run · 1 h 10 min\n\n${steps}\n\nFlat route.\n\n${MIRROR_FOOTER}`)
  })

  it('cuts very long steps at a line break, and stays inside the description limit', () => {
    const line = '- 1m Z2 HR'
    const steps = Array.from({ length: 1000 }, () => line).join('\n')
    const e = mirrorEvent({ id: 's7', date: '2026-11-22', name: 'Long', sport: 'run', steps, notes: 'n'.repeat(5000) }, 'metric')
    expect(e.description.length).toBeLessThanOrEqual(8000)
    const kept = e.description.split('\n\n')[1]!.split('\n')
    expect(kept.at(-1)).toBe('…')
    expect(kept.slice(0, -1).every((l) => l === line)).toBe(true)
  })

  it('clips plain text without a line break too', () => {
    expect(clip('abcdefghij', 6)).toBe('abcd\n…')
    expect(clip('  short  ', 6)).toBe('short')
    expect(clip('   ', 6)).toBeUndefined()
  })
})
