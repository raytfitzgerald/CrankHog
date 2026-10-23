import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PACKS } from '@core/persona'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { customCoachStore } from '../../coach/custom'
import { resetHeadCycles } from '../../coach/toon/motion'
import { db } from '../../db/db'
import { createWebShim } from '../../platform/web-shim'
import { settingsStore } from '../../stores/settings'
import { CoachSection } from './CoachSection'

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)))

beforeEach(() => {
  localStorage.clear()
  // the browser shim stands in for main: settings round-trip, AI is not configured
  window.crankhog = createWebShim()
  settingsStore.setState(DEFAULT_SETTINGS, true)
})
afterEach(cleanup)

describe('CoachSection', () => {
  it('makes a custom coach from the + tile, picks it, and refuses a line about bodies', async () => {
    customCoachStore.setState({ coaches: [], lines: {} })
    await db().delete()
    await db().open()
    render(<CoachSection />)
    await flush()
    fireEvent.click(screen.getByTestId('persona-add-custom'))
    const save = screen.getByTestId('custom-coach-save')
    expect((save as HTMLButtonElement).disabled).toBe(true) // no name yet
    fireEvent.change(screen.getByTestId('custom-coach-name'), { target: { value: 'Uncle Rog' } })
    fireEvent.change(screen.getByTestId('custom-coach-persona'), { target: { value: 'A retired domestique. Dry and blunt.' } })
    fireEvent.click(screen.getByTestId('custom-coach-add-line'))
    const line = within(screen.getByTestId('custom-coach-line')).getByLabelText('Line')
    fireEvent.change(line, { target: { value: 'Move it, you fat lump' } })
    expect(screen.getByTestId('custom-coach-line').textContent).toMatch(/bodies and weight/)
    expect((save as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(line, { target: { value: 'Right then. Legs on.' } })
    expect((save as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(save)
    await flush()
    await flush()
    const [coach] = customCoachStore.getState().coaches
    expect(coach).toMatchObject({ name: 'Uncle Rog', phrases: [{ text: 'Right then. Legs on.', moment: 'any' }] })
    expect(settingsStore.getState().coach.personaId).toBe(coach!.id)
    expect(screen.getByTestId(`persona-${coach!.id}`).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId(`persona-${coach!.id}`).textContent).toContain('A retired domestique.')
  })

  it('lists every persona with its style', async () => {
    render(<CoachSection />)
    await flush()
    for (const p of PACKS) {
      const card = screen.getByTestId(`persona-${p.meta.id}`)
      expect(card.textContent).toContain(p.meta.name)
      expect(card.textContent).toContain(p.meta.tagline)
    }
  })

  it('selects Bibi when that card is picked', async () => {
    render(<CoachSection />)
    await flush()
    fireEvent.click(screen.getByTestId('persona-bibi'))
    await flush()
    expect(settingsStore.getState().coach.personaId).toBe('bibi')
    expect(screen.getByTestId('persona-bibi').getAttribute('aria-pressed')).toBe('true')
  })

  it('previews a sample line in the chosen persona', async () => {
    render(<CoachSection />)
    await flush()
    fireEvent.click(screen.getByTestId('coach-preview'))
    expect(screen.getByTestId('coach-sample').textContent).toMatch(/“.+”/)
  })

  it('shows Bibi as a caricature that swaps photos with every sample', async () => {
    resetHeadCycles()
    render(<CoachSection />)
    await flush()
    expect(screen.queryByTestId('coach-toon')).toBeNull() // the drill sergeant is a monogram
    fireEvent.click(screen.getByTestId('persona-bibi'))
    await flush()
    const toon = screen.getByRole('img', { name: /Bibi, riding a bike/ })
    const heads = [toon.dataset.head]
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByTestId('coach-preview'))
      await flush()
      heads.push(screen.getByTestId('coach-toon').dataset.head)
    }
    expect(heads).toEqual(['0', '1', '2', '0'])
    expect(screen.getByTestId('coach-sample').textContent).toMatch(/“.+”/)
  })

  it('gives The Donald his own caricature, with four photos and a long red tie', async () => {
    resetHeadCycles()
    render(<CoachSection />)
    await flush()
    fireEvent.click(screen.getByTestId('persona-trump'))
    await flush()
    const toon = screen.getByRole('img', { name: /The Donald, riding a bike/ })
    expect(toon.querySelector('[data-part="tie"]')?.getAttribute('fill')).toBe('#d7263d')
    const heads = [toon.dataset.head]
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('coach-preview'))
      await flush()
      heads.push(screen.getByTestId('coach-toon').dataset.head)
    }
    expect(heads).toEqual(['0', '1', '2', '3', '0'])
  })

  it('offers spice levels with labels, and hides the AI switch without an AI provider', async () => {
    render(<CoachSection />)
    await flush()
    const spice = screen.getByRole('radiogroup', { name: 'Spice level' })
    expect(within(spice).getAllByRole('radio').map((r) => r.textContent)).toEqual(['1 Gentle', '2 Cheeky', '3 Snarky', '4 Savage', '5 Feral'])
    fireEvent.click(within(spice).getByText('5 Feral'))
    await flush()
    expect(settingsStore.getState().coach.spice).toBe(5)
    expect(screen.queryByText('Use AI for fresh lines')).toBeNull()
  })
})
