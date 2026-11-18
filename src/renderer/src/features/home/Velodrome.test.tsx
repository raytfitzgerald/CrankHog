import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Velodrome } from './Velodrome'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** The hooks read `matchMedia`; happy-dom doesn't have one. */
vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }))

const hog = { id: 'sir-loin', label: 'Sir Loin', lapS: 8.5 }
const rider = { id: 'ride-1', label: 'Tuesday', lapS: 9 }

describe('cranking Sir Loin on the velodrome', () => {
  it('says whether a click on the track landed on him', () => {
    const onCrank = vi.fn()
    render(<Velodrome riders={[rider]} hog={hog} head={<circle />} onCrank={onCrank} />)
    fireEvent.click(screen.getByTestId('velodrome-hog'))
    expect(onCrank).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByTestId('velodrome-rider'))
    expect(onCrank).toHaveBeenLastCalledWith(false)
    fireEvent.click(screen.getByRole('img'))
    expect(onCrank).toHaveBeenLastCalledWith(false)
    expect(onCrank).toHaveBeenCalledTimes(3)
  })

  it('takes no clicks where he can’t be cranked', () => {
    const { container } = render(<Velodrome riders={[]} hog={hog} head={<circle />} />)
    // nothing to hear the click, and nothing to break
    fireEvent.click(screen.getByTestId('velodrome-hog'))
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
