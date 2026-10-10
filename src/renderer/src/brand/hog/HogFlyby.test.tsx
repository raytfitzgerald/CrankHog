import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FIRST_PASS_S } from '@core/mascot/hog'
import { STUNTS, stuntWeights, type HogContext } from '@core/mascot/stunts'
import { HogFlyby } from './HogFlyby'
import { HogVerge } from './HogVerge'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** A flat road, mid-route, riding steadily, wheel to wheel with him. */
const road: HogContext = { gradePct: 0, progress: 0.4, intensity: 0.8, gapM: 0 }

/** The hooks read `matchMedia`; happy-dom doesn't have one. */
const reduceMotion = (on: boolean) =>
  vi.stubGlobal('matchMedia', () => ({ matches: on, addEventListener: () => undefined, removeEventListener: () => undefined }))

describe('Sir Loin coming past on a route', () => {
  it('stays away for the first few minutes', () => {
    reduceMotion(false)
    render(<HogFlyby elapsedS={30} moving context={road} />)
    expect(screen.queryByTestId('hog-flyby')).toBeNull()
    expect(screen.queryByTestId('hog-flyby-line')).toBeNull()
  })

  it('rides past, with a line, once the ride has got far enough', () => {
    reduceMotion(false)
    const { rerender } = render(<HogFlyby elapsedS={0} moving context={road} />)
    rerender(<HogFlyby elapsedS={FIRST_PASS_S.max} moving context={road} />)
    expect(screen.getByTestId('hog-flyby')).not.toBeNull()
    expect(screen.getByTestId('hog-flyby-line').textContent).toMatch(/Sir Loin|hog/i)
  })

  it('never comes past while the rider is stopped', () => {
    reduceMotion(false)
    const { rerender } = render(<HogFlyby elapsedS={0} moving={false} context={road} />)
    rerender(<HogFlyby elapsedS={FIRST_PASS_S.max * 4} moving={false} context={road} />)
    expect(screen.queryByTestId('hog-flyby')).toBeNull()
  })

  it('does something the road has asked for, and draws that stunt', () => {
    reduceMotion(false)
    // a wall: he grinds up it, or gives up and has lunch beside it
    const wall: HogContext = { ...road, gradePct: 11 }
    const allowed = stuntWeights(wall).map(([st]) => st)
    const { rerender } = render(<HogFlyby elapsedS={0} moving context={wall} />)
    rerender(<HogFlyby elapsedS={FIRST_PASS_S.max} moving context={wall} />)
    const stunt = screen.getByTestId('hog-flyby').getAttribute('data-stunt')
    expect(allowed).toContain(stunt)
    // and the line he says belongs to it
    expect(STUNTS[stunt as keyof typeof STUNTS].lines).toContain(screen.getByTestId('hog-flyby-line').textContent)
  })

  it('rides past the roadside stunts the other way, because you overtake those', () => {
    reduceMotion(false)
    // a long way up the road: every option there is one he is stopped for
    const waiting: HogContext = { ...road, gapM: 400 }
    const { rerender } = render(<HogFlyby elapsedS={0} moving context={waiting} />)
    rerender(<HogFlyby elapsedS={FIRST_PASS_S.max} moving context={waiting} />)
    const el = screen.getByTestId('hog-flyby')
    expect(STUNTS[el.getAttribute('data-stunt') as keyof typeof STUNTS].kind).toBe('roadside')
    expect(el.getAttribute('style')).toContain('hog-verge')
  })

  it('keeps the line but drops the animation under Reduce Motion', () => {
    reduceMotion(true)
    const { rerender } = render(<HogFlyby elapsedS={0} moving context={road} />)
    rerender(<HogFlyby elapsedS={FIRST_PASS_S.max} moving context={road} />)
    expect(screen.queryByTestId('hog-flyby')).toBeNull()
    expect(screen.getByTestId('hog-flyby-line')).not.toBeNull()
  })
})

describe('Sir Loin trotting the verge', () => {
  it('turns up, eventually, and says nothing', () => {
    reduceMotion(false)
    const { rerender } = render(<HogVerge elapsedS={0} moving />)
    rerender(<HogVerge elapsedS={600} moving />)
    const trot = screen.getByTestId('hog-verge')
    expect(trot).not.toBeNull()
    // he's scenery here: hidden from screen readers, no line of his own
    expect(trot.getAttribute('aria-hidden')).toBe('true')
  })

  it('does not appear at all under Reduce Motion', () => {
    reduceMotion(true)
    const { rerender } = render(<HogVerge elapsedS={0} moving />)
    rerender(<HogVerge elapsedS={600} moving />)
    expect(screen.queryByTestId('hog-verge')).toBeNull()
  })
})
