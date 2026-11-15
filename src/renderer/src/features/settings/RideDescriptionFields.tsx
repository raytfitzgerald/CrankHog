import { useState } from 'react'
import { DESCRIPTION_STATS, MAX_DESCRIPTION, STATS_TOKEN, uploadDescription, type DescriptionStat } from '@core/ride/upload-text'
import { DEFAULT_DESCRIPTION_STATS, DEFAULT_RIDE_DESCRIPTION } from '@shared/settings'
import { patchSettings, useSettings } from '../../stores/settings'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/form'

// The description under each uploaded ride (Strava and intervals.icu): the
// rider's own text, with {stats} for the numbers they tick.

const SAMPLE = { avgPower: 205, np: 210, maxPower: 612, avgHr: 142, maxHr: 171, avgCadence: 88, kj: 812, tss: 65, intensityFactor: 0.82 }

const area =
  'no-drag w-full resize-y rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none'

export function RideDescriptionFields() {
  const prefs = useSettings((s) => s.rideDescription)
  // what's typed, until it's saved on blur
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? prefs.text
  const saveText = () => {
    if (draft !== null && draft !== prefs.text) void patchSettings({ rideDescription: { text: draft.slice(0, MAX_DESCRIPTION) } })
    setDraft(null)
  }
  const toggle = (id: DescriptionStat, on: boolean) =>
    void patchSettings({ rideDescription: { stats: on ? [...prefs.stats.filter((s) => s !== id), id] : prefs.stats.filter((s) => s !== id) } })
  const reset = () => {
    setDraft(null)
    void patchSettings({ rideDescription: { text: DEFAULT_RIDE_DESCRIPTION, stats: [...DEFAULT_DESCRIPTION_STATS] } })
  }
  const preview = uploadDescription({ text, stats: prefs.stats, numbers: SAMPLE })

  return (
    <>
      <Field label="Ride description" hint={`Goes under each ride CrankHog uploads to Strava or intervals.icu. ${STATS_TOKEN} is replaced by the numbers ticked below.`}>
        <textarea
          className={area}
          rows={4}
          value={text}
          maxLength={MAX_DESCRIPTION}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveText}
          aria-label="Ride description"
          data-testid="ride-description-text"
        />
        <div className="pt-1">
          <Button size="sm" variant="ghost" onClick={reset} data-testid="ride-description-reset">
            Reset description
          </Button>
        </div>
      </Field>
      <Field label="Numbers" hint="Each one appears only when the ride has it, such as heart rate with a strap.">
        <div className="flex flex-col gap-2 pt-2 text-sm" role="group" aria-label="Numbers in the description">
          {DESCRIPTION_STATS.map((s) => (
            <label key={s.id} className="flex items-center gap-2">
              <input type="checkbox" checked={prefs.stats.includes(s.id)} onChange={(e) => toggle(s.id, e.target.checked)} data-testid={`ride-description-stat-${s.id}`} />
              {s.label}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Preview">
        <div className="whitespace-pre-line pt-2 text-sm text-ink-dim" data-testid="ride-description-preview">
          {preview || 'No description: the ride goes up without one.'}
        </div>
      </Field>
    </>
  )
}
