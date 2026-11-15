import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { createWebShim } from '../../platform/web-shim'
import { settingsStore } from '../../stores/settings'
import { RideDescriptionFields } from './RideDescriptionFields'

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)))
const preview = () => screen.getByTestId('ride-description-preview').textContent

beforeEach(() => {
  localStorage.clear()
  window.crankhog = createWebShim()
  settingsStore.setState(DEFAULT_SETTINGS, true)
})
afterEach(cleanup)

describe('RideDescriptionFields', () => {
  it('starts on a hog line with the numbers, and previews it', () => {
    render(<RideDescriptionFields />)
    expect(preview()).toMatch(/with CrankHog · crankhog\.app/)
    expect(preview()).toContain('NP 210 W · IF 0.82 · TSS 65 · 812 kJ · avg HR 145')
  })

  it("saves the rider's own line on blur, and previews it as typed", async () => {
    render(<RideDescriptionFields />)
    fireEvent.change(screen.getByTestId('ride-description-line'), { target: { value: 'custom' } })
    await flush()
    const input = screen.getByTestId('ride-description-custom')
    fireEvent.change(input, { target: { value: 'Suffered in the shed' } })
    expect(preview()).toContain('Suffered in the shed')
    expect(settingsStore.getState().rideDescription.custom).toBe('')
    fireEvent.blur(input)
    await flush()
    expect(settingsStore.getState().rideDescription).toEqual({ line: 'custom', custom: 'Suffered in the shed', stats: true })
  })

  it('says so when there is nothing to write', async () => {
    render(<RideDescriptionFields />)
    fireEvent.change(screen.getByTestId('ride-description-line'), { target: { value: 'none' } })
    await flush()
    fireEvent.click(screen.getByRole('switch'))
    await flush()
    expect(settingsStore.getState().rideDescription).toMatchObject({ line: 'none', stats: false })
    expect(preview()).toBe('No description: Strava shows the ride without one.')
  })
})
