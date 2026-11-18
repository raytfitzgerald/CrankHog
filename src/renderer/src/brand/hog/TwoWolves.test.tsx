import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TWO_WOLVES, WOLF_BEATS_MS, WOLVES_CALM_MS, WOLVES_REST_DELAY_MS, WOLVES_REST_MS } from '@core/mascot/crank'
import { TwoWolves } from './TwoWolves'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** The hooks read `matchMedia`; happy-dom doesn't have one. */
const reduceMotion = (on: boolean) =>
  vi.stubGlobal('matchMedia', () => ({ matches: on, addEventListener: () => undefined, removeEventListener: () => undefined }))

describe('the two wolves', () => {
  it("puts up the picture's own captions one at a time, slams the punchline down, then the rest, and never a word of its own", () => {
    reduceMotion(false)
    vi.useFakeTimers()
    render(<TwoWolves onClose={() => undefined} />)
    const wolves = screen.getByRole('dialog', { name: 'Two wolves' })
    expect(screen.getAllByTestId('two-wolves-caption')).toHaveLength(2)
    expect(screen.queryByAltText(TWO_WOLVES.setup[0])).toBeNull()
    act(() => vi.advanceTimersByTime(WOLF_BEATS_MS[0]))
    expect(screen.getByAltText(TWO_WOLVES.setup[0])).toBeTruthy()
    expect(screen.queryByAltText(TWO_WOLVES.setup[1])).toBeNull()
    expect(wolves.textContent).toBe('')
    act(() => vi.advanceTimersByTime(WOLF_BEATS_MS[1] - WOLF_BEATS_MS[0]))
    expect(screen.getByAltText(TWO_WOLVES.setup[1])).toBeTruthy()
    expect(screen.queryByTestId('two-wolves-picture')).toBeNull()
    expect(screen.queryByTestId('two-wolves-punchline')).toBeNull()
    act(() => vi.advanceTimersByTime(WOLF_BEATS_MS[2] - WOLF_BEATS_MS[1]))
    expect(screen.getByTestId('two-wolves-punchline')).toBeTruthy()
    expect(screen.getByAltText(TWO_WOLVES.picture)).toBeTruthy()
    // the rest comes up slowly, and it's done when it says so
    expect(wolves.dataset.whole).toBeUndefined()
    act(() => vi.advanceTimersByTime(WOLVES_REST_DELAY_MS + WOLVES_REST_MS))
    expect(wolves.dataset.whole).toBe('true')
    // the captions stay underneath, but only the whole picture is read out
    expect(screen.queryByAltText(TWO_WOLVES.setup[0])).toBeNull()
    expect(screen.queryByAltText(TWO_WOLVES.setup[1])).toBeNull()
    expect(wolves.textContent).toBe('')
  })

  it('skips to the punchline on a click, and closes once the picture is all up', () => {
    reduceMotion(false)
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<TwoWolves onClose={onClose} />)
    act(() => vi.advanceTimersByTime(WOLVES_CALM_MS))
    fireEvent.click(screen.getByTestId('two-wolves'))
    expect(screen.getByTestId('two-wolves-punchline')).toBeTruthy()
    // the rest of the picture comes up at its own pace, calm clicks or not
    act(() => vi.advanceTimersByTime(WOLVES_REST_DELAY_MS + WOLVES_REST_MS - 100))
    fireEvent.click(screen.getByTestId('two-wolves'))
    expect(onClose).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(WOLVES_CALM_MS))
    fireEvent.click(screen.getByTestId('two-wolves'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('lets the run of clicks that cranked him carry on without skipping or closing anything', () => {
    reduceMotion(false)
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<TwoWolves onClose={onClose} />)
    const wolves = screen.getByTestId('two-wolves')
    // five clicks a second, for ten seconds: well past the setup and the picture landing
    for (let i = 0; i < 50; i++) {
      fireEvent.click(wolves)
      if (i === 5) expect(screen.queryByTestId('two-wolves-picture')).toBeNull()
      act(() => vi.advanceTimersByTime(200))
    }
    expect(screen.getByTestId('two-wolves-picture')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    // then they stop, look, and click
    act(() => vi.advanceTimersByTime(WOLVES_CALM_MS))
    fireEvent.click(wolves)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("doesn't go back to the setup once the picture is up", () => {
    reduceMotion(false)
    vi.useFakeTimers()
    render(<TwoWolves onClose={() => undefined} />)
    act(() => vi.advanceTimersByTime(WOLVES_CALM_MS))
    fireEvent.click(screen.getByTestId('two-wolves'))
    act(() => vi.advanceTimersByTime(WOLF_BEATS_MS[1]))
    expect(screen.getByTestId('two-wolves-picture')).toBeTruthy()
  })

  it('closes on Esc, at any point', () => {
    reduceMotion(true)
    const onClose = vi.fn()
    render(<TwoWolves onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
