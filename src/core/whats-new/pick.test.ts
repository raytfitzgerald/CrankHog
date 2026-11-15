import { describe, expect, it } from 'vitest'
import type { WhatsNewEntry } from './notes'
import { compareVersions, latestNotes, MAX_ENTRIES, notesToShow } from './pick'

const entry = (version: string): WhatsNewEntry => ({ version, title: `${version} title`, points: ['a point'] })
const NOTES = ['0.7.1', '0.7.0', '0.6.5', '0.6.4'].map(entry)
const shown = (input: Parameters<typeof notesToShow>[0]) => notesToShow({ notes: NOTES, ...input }).map((n) => n.version)

describe('compareVersions', () => {
  it('compares each part as a number', () => {
    expect(compareVersions('0.6.10', '0.6.9')).toBe(1)
    expect(compareVersions('0.6.4', '0.7.0')).toBe(-1)
    expect(compareVersions('1.0.0', '0.99.99')).toBe(1)
  })

  it('treats a missing part as zero and ignores a build suffix', () => {
    expect(compareVersions('0.7', '0.7.0')).toBe(0)
    expect(compareVersions('0.6.4-web', '0.6.4')).toBe(0)
  })
})

describe('notesToShow', () => {
  it('shows nothing on a new install', () => {
    expect(shown({ seen: null, current: '0.7.1', returning: false })).toEqual([])
  })

  it('shows only the running version after an update from before the notes existed', () => {
    expect(shown({ seen: null, current: '0.7.0', returning: true })).toEqual(['0.7.0'])
  })

  it('shows the release just installed', () => {
    expect(shown({ seen: '0.7.0', current: '0.7.1', returning: true })).toEqual(['0.7.1'])
  })

  it('shows every release skipped since the last one seen, newest first', () => {
    expect(shown({ seen: '0.6.4', current: '0.7.1', returning: true })).toEqual(['0.7.1', '0.7.0', '0.6.5'])
  })

  it(`stops at ${MAX_ENTRIES} after a long gap`, () => {
    expect(shown({ seen: '0.6.0', current: '0.7.1', returning: true })).toHaveLength(MAX_ENTRIES)
  })

  it('shows nothing once seen, after a downgrade, or for a version with no entry', () => {
    expect(shown({ seen: '0.7.1', current: '0.7.1', returning: true })).toEqual([])
    expect(shown({ seen: '0.7.1', current: '0.7.0', returning: true })).toEqual([])
    expect(shown({ seen: null, current: '0.6.6', returning: true })).toEqual([])
  })

  it('reads the web build version', () => {
    expect(shown({ seen: '0.7.0', current: '0.7.1-web', returning: true })).toEqual(['0.7.1'])
  })
})

describe('latestNotes', () => {
  it("finds the running version's notes, or the latest before it", () => {
    expect(latestNotes('0.7.0', NOTES)?.version).toBe('0.7.0')
    expect(latestNotes('0.6.9', NOTES)?.version).toBe('0.6.5')
    expect(latestNotes('0.6.0', NOTES)).toBeNull()
  })
})
