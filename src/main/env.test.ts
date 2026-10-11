import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 0.6.0's bug lived here rather than in user-data.ts: the rename logic was
// right, but configureUserData handed it `app.getPath('userData')`, and that
// call creates the folder it names. migrateDir then saw a destination that
// already existed and correctly refused, so no upgrade ever moved its rides.
// These tests stand in for Electron and watch which paths get asked for.
const state = vi.hoisted(() => ({
  asked: [] as string[],
  appData: '',
  documents: '',
  switches: new Set<string>(),
  isPackaged: true,
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getName: () => 'CrankHog',
    setPath: () => undefined,
    commandLine: { hasSwitch: (s: string) => state.switches.has(s) },
    getPath: (key: string) => {
      state.asked.push(key)
      if (key === 'appData') return state.appData
      if (key === 'documents') return state.documents
      // The real Electron creates this folder on the way out. Do the same, so a
      // test fails the way the shipped app did rather than passing in theory.
      if (key === 'userData') {
        const dir = join(state.appData, 'CrankHog')
        mkdirSync(dir, { recursive: true })
        return dir
      }
      throw new Error(`unexpected getPath(${key})`)
    },
  },
}))

const { configureUserData } = await import('./env')

const seed = (dir: string, body: string) => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'rides.json'), body)
}

describe('configureUserData on a packaged launch', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'crankhog-env-'))
    state.appData = join(root, 'Application Support')
    state.documents = join(root, 'Documents')
    mkdirSync(state.appData, { recursive: true })
    mkdirSync(state.documents, { recursive: true })
    state.asked = []
    state.switches = new Set()
    delete process.env.CRANKHOG_USER_DATA
  })

  it('carries a FreeGaz profile and its rides over', () => {
    seed(join(state.appData, 'FreeGaz'), 'every ride')
    seed(join(state.documents, 'FreeGaz'), 'fit files')

    configureUserData()

    expect(readFileSync(join(state.appData, 'CrankHog', 'rides.json'), 'utf8')).toBe('every ride')
    expect(readFileSync(join(state.documents, 'CrankHog', 'rides.json'), 'utf8')).toBe('fit files')
    expect(existsSync(join(state.appData, 'FreeGaz'))).toBe(false)
  })

  it('never asks Electron for userData, because asking creates it', () => {
    seed(join(state.appData, 'FreeGaz'), 'every ride')

    configureUserData()

    // The regression itself: one getPath('userData') here and the profile
    // above stays behind in FreeGaz, which reads to a rider as losing the lot.
    expect(state.asked).not.toContain('userData')
  })

  it('leaves a profile alone when Electron was pointed somewhere else', () => {
    seed(join(state.appData, 'FreeGaz'), 'every ride')
    state.switches.add('user-data-dir')

    configureUserData()

    expect(existsSync(join(state.appData, 'FreeGaz'))).toBe(true)
    expect(existsSync(join(state.appData, 'CrankHog'))).toBe(false)
  })
})
