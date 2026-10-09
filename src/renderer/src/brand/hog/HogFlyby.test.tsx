import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FIRST_PASS_S } from '@core/mascot/hog'
import { HogFlyby } from './HogFlyby'
import { HogVerge } from './HogVerge'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** The hooks read `matchMedia`; happy-dom doesn't have one. */
const reduceMotion = (on: boolean) =>
  vi.stubGlobal('matchMedia', () => ({ matches: on, addEventListener: () => undefined, removeEventListener: () => undefined }))

describe('Sir Loin coming past on a route', () => {
  it('stays away for the first few minutes', () => {
    reduceMotion(false)
    render(<HogFlyby elapsedS={30} moving />)
    expect(screen.queryByTestId('hog-flyby')).toBeNull()
    expect(screen.queryByTestId('hog-flyby-line')).toBeNull()
  })

  it('rides past, with a line, once the ride has got far enough', () => {
    reduceMotion(false)
    const { rerender } = render(<HogFlyby elapsedS={0} moving />)
    rerender(<HogFlyby elapsedS={FIRST_PASS_S.max} moving />)
    expect(screen.getByTestId('hog-flyby')).not.toBeNull()
    expect(screen.getByTestId('hog-flyby-line').textContent).toMatch(/Sir Loin|hog/i)
  })

  it('never comes past while the rider is stopped', () => {
    reduceMotion(false)
    const { rerender } = render(<HogFlyby elapsedS={0} moving={false} />)
    rerender(<HogFlyby elapsedS={FIRST_PASS_S.max * 4} moving={false} />)
    expect(screen.queryByTestId('hog-flyby')).toBeNull()
  })

  it('keeps the line but drops the animation under Reduce Motion', () => {
    reduceMotion(true)
    const { rerender } = render(<HogFlyby elapsedS={0} moving />)
    rerender(<HogFlyby elapsedS={FIRST_PASS_S.max} moving />)
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
