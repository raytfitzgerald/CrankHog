import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DESCRIPTION_STATS } from '@core/ride/upload-text'
import { DEFAULT_SETTINGS, DESCRIPTION_STAT_IDS } from '@shared/settings'
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
  it('offers every number the settings accept', () => {
    expect(DESCRIPTION_STATS.map((s) => s.id)).toEqual([...DESCRIPTION_STAT_IDS])
  })

  it('starts with the hog line, average power, average HR and total output', () => {
    render(<RideDescriptionFields />)
    expect(preview()).toBe('Cranked hog with CrankHog\nAvg power 205 W · Avg HR 142 bpm · Total output 812 kJ\nCrankHog.app')
  })

  it('saves the edited text on blur, previewing it as typed', async () => {
    render(<RideDescriptionFields />)
    const area = screen.getByTestId('ride-description-text')
    fireEvent.change(area, { target: { value: 'Suffered in the shed\n{stats}' } })
    expect(preview()).toBe('Suffered in the shed\nAvg power 205 W · Avg HR 142 bpm · Total output 812 kJ')
    expect(settingsStore.getState().rideDescription.text).toContain('Cranked hog')
    fireEvent.blur(area)
    await flush()
    expect(settingsStore.getState().rideDescription.text).toBe('Suffered in the shed\n{stats}')
  })

  it('ticks numbers on and off, and resets', async () => {
    render(<RideDescriptionFields />)
    fireEvent.click(screen.getByTestId('ride-description-stat-avgHr'))
    await flush()
    fireEvent.click(screen.getByTestId('ride-description-stat-tss'))
    await flush()
    expect(settingsStore.getState().rideDescription.stats).toEqual(['avgPower', 'kj', 'tss'])
    expect(preview()).toContain('Avg power 205 W · Total output 812 kJ · TSS 65')
    fireEvent.click(screen.getByTestId('ride-description-reset'))
    await flush()
    expect(settingsStore.getState().rideDescription).toEqual(DEFAULT_SETTINGS.rideDescription)
  })
})
