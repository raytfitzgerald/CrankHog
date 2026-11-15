// Every release tells riders what changed: bumping the version in
// package.json without a What's new entry fails here, before it can ship.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WHATS_NEW } from '@core/whats-new/notes'
import { compareVersions } from '@core/whats-new/pick'

const { version } = JSON.parse(readFileSync(join(import.meta.dirname, '../../package.json'), 'utf8')) as { version: string }

describe("What's new", () => {
  it(`has an entry for ${version}, the version in package.json`, () => {
    expect(
      WHATS_NEW.some((n) => n.version === version),
      `Add a short entry for ${version} at the top of src/core/whats-new/notes.ts`,
    ).toBe(true)
  })

  it('lists each version once, newest first', () => {
    const versions = WHATS_NEW.map((n) => n.version)
    expect(new Set(versions).size).toBe(versions.length)
    expect([...versions].sort((a, b) => compareVersions(b, a))).toEqual(versions)
  })

  it.each(WHATS_NEW.map((n) => [n.version, n] as const))('keeps %s short and in the app voice', (_, n) => {
    expect(n.title.length).toBeLessThanOrEqual(100)
    expect(n.points.length).toBeGreaterThanOrEqual(1)
    expect(n.points.length).toBeLessThanOrEqual(4)
    for (const text of [n.title, ...n.points]) {
      expect(text.length).toBeLessThanOrEqual(200)
      expect(text).not.toMatch(/!|\p{Extended_Pictographic}/u)
    }
  })
})
