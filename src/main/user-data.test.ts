import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateDir, migrateFromFreeGaz } from './user-data'

let root: string

const seed = (dir: string, contents: string) => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'rides.json'), contents)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'crankhog-migrate-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('the FreeGaz → CrankHog folder rename', () => {
  it('moves the old folder across, contents intact', () => {
    seed(join(root, 'FreeGaz'), 'every ride')
    const out = migrateDir(root)
    expect(out).toMatchObject({ moved: true })
    expect(readFileSync(join(root, 'CrankHog', 'rides.json'), 'utf8')).toBe('every ride')
  })

  it('does nothing on the second launch', () => {
    seed(join(root, 'FreeGaz'), 'every ride')
    expect(migrateDir(root).moved).toBe(true)
    expect(migrateDir(root)).toEqual({ moved: false, reason: 'already-migrated' })
    expect(readFileSync(join(root, 'CrankHog', 'rides.json'), 'utf8')).toBe('every ride')
  })

  it('does nothing for a fresh install', () => {
    expect(migrateDir(root)).toEqual({ moved: false, reason: 'nothing-to-move' })
  })

  it('refuses to merge when the rider has run both versions', () => {
    seed(join(root, 'FreeGaz'), 'old rides')
    seed(join(root, 'CrankHog'), 'new rides')
    expect(migrateDir(root)).toEqual({ moved: false, reason: 'both-exist' })
    // neither side is touched: merging two profiles is worse than keeping both
    expect(readFileSync(join(root, 'FreeGaz', 'rides.json'), 'utf8')).toBe('old rides')
    expect(readFileSync(join(root, 'CrankHog', 'rides.json'), 'utf8')).toBe('new rides')
  })

  it('moves the profile and the exported rides together', () => {
    seed(join(root, 'support', 'FreeGaz'), 'profile')
    seed(join(root, 'docs', 'FreeGaz'), 'fit files')
    const out = migrateFromFreeGaz({ userData: join(root, 'support', 'CrankHog'), documents: join(root, 'docs') })
    expect(out.profile.moved).toBe(true)
    expect(out.rides.moved).toBe(true)
    expect(readFileSync(join(root, 'support', 'CrankHog', 'rides.json'), 'utf8')).toBe('profile')
    expect(readFileSync(join(root, 'docs', 'CrankHog', 'rides.json'), 'utf8')).toBe('fit files')
  })

  it('leaves a custom profile directory alone', () => {
    // dev and E2E runs point userData somewhere else entirely (CrankHog-dev, a
    // temp dir); renaming that folder's sibling would be nonsense.
    seed(join(root, 'support', 'FreeGaz'), 'the real profile')
    const out = migrateFromFreeGaz({ userData: join(root, 'support', 'CrankHog-dev'), documents: join(root, 'docs') })
    expect(out.profile).toEqual({ moved: false, reason: 'nothing-to-move' })
    expect(readFileSync(join(root, 'support', 'FreeGaz', 'rides.json'), 'utf8')).toBe('the real profile')
  })

  it('reports a failure instead of throwing', () => {
    // a file where the folder should be: rename cannot work, and must not crash the app
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, 'FreeGaz'), 'not a directory')
    mkdirSync(join(root, 'CrankHog', 'busy'), { recursive: true })
    const out = migrateDir(root)
    expect(out.moved).toBe(false)
  })
})
