import { useState } from 'react'
import { MAX_CUSTOM_LINE, uploadDescription, type DescriptionLine } from '@core/ride/upload-text'
import { patchSettings, useSettings } from '../../stores/settings'
import { Field, Input, Select, Switch } from '../../ui/form'

// The description under each uploaded ride (Strava and intervals.icu):
// CrankHog's line, the rider's own or none, and whether the numbers go too.

const LINES: readonly { id: DescriptionLine; label: string }[] = [
  { id: 'hog', label: 'A different hog line each ride' },
  { id: 'cranked', label: 'Cranked hog with CrankHog' },
  { id: 'whole-hog', label: 'Went the whole hog with CrankHog' },
  { id: 'recorded', label: 'Recorded with CrankHog' },
  { id: 'custom', label: 'Your own line' },
  { id: 'none', label: 'No line' },
]

const SAMPLE = { np: 210, intensityFactor: 0.82, tss: 65, kj: 812, avgHr: 145 }

export function RideDescriptionFields() {
  const prefs = useSettings((s) => s.rideDescription)
  // what's typed, until it's saved on blur or Enter
  const [draft, setDraft] = useState<string | null>(null)
  const custom = draft ?? prefs.custom
  const saveCustom = () => {
    if (draft !== null && draft !== prefs.custom) void patchSettings({ rideDescription: { custom: draft.slice(0, MAX_CUSTOM_LINE) } })
    setDraft(null)
  }
  const preview = uploadDescription({ prefs: { ...prefs, custom }, rideId: 'preview', numbers: SAMPLE })

  return (
    <>
      <Field label="Ride description" hint="The first line under each ride CrankHog uploads to Strava or intervals.icu.">
        <Select
          value={prefs.line}
          onChange={(e) => void patchSettings({ rideDescription: { line: e.target.value as DescriptionLine } })}
          aria-label="First line of the ride description"
          data-testid="ride-description-line"
        >
          {LINES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
      </Field>
      {prefs.line === 'custom' && (
        <Field label="Your line">
          <Input
            value={custom}
            maxLength={MAX_CUSTOM_LINE}
            placeholder="Suffered in the shed again"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveCustom}
            onKeyDown={(e) => e.key === 'Enter' && saveCustom()}
            data-testid="ride-description-custom"
          />
        </Field>
      )}
      <Field label="Include the numbers" hint="NP, IF, TSS, kJ and average heart rate, on the line after.">
        <Switch checked={prefs.stats} onChange={(v) => void patchSettings({ rideDescription: { stats: v } })} label={prefs.stats ? 'On' : 'Off'} />
      </Field>
      <Field label="Preview">
        <div className="whitespace-pre-line pt-2 text-sm text-ink-dim" data-testid="ride-description-preview">
          {preview || 'No description: Strava shows the ride without one.'}
        </div>
      </Field>
    </>
  )
}
