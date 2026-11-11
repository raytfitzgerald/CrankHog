import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/settings'

const native = vi.hoisted(() => ({ on: false }))
vi.mock('../platform/native', () => ({ isNative: () => native.on }))
const { availablePacks, withAvailableCoach } = await import('./available')

const trumpRider = { ...DEFAULT_SETTINGS, coach: { ...DEFAULT_SETTINGS.coach, personaId: 'trump' } }

describe('coaches per build', () => {
  afterEach(() => {
    native.on = false
  })

  it('the Mac and web apps offer every coach, and keep the one you picked', () => {
    expect(availablePacks().map((p) => p.meta.id)).toContain('trump')
    expect(withAvailableCoach(trumpRider).coach.personaId).toBe('trump')
  })

  it('the iPhone app leaves out the parodies of real people and the borrowed characters', () => {
    native.on = true
    const ids = availablePacks().map((p) => p.meta.id)
    for (const id of ['trump', 'bibi', 'hillary', 'barack', 'charlie-kirk', 'elizabeth-holmes', 'iron-mike', 'eric-andre', 'dj-khaled', 'shrek', 'slender-man']) expect(ids).not.toContain(id)
    expect(ids).toContain('drill-sergeant')
    expect(ids).toContain('fat-guy')
    expect(ids).toHaveLength(16)
  })

  it('a hidden coach (from an old setting or a restored Mac backup) becomes the default coach on the iPhone', () => {
    native.on = true
    expect(withAvailableCoach(trumpRider).coach.personaId).toBe(DEFAULT_SETTINGS.coach.personaId)
    expect(withAvailableCoach(DEFAULT_SETTINGS)).toBe(DEFAULT_SETTINGS)
  })
})
