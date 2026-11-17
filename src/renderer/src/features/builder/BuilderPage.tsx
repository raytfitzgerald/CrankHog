import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { PageHeader } from '../../ui/PageHeader'
import { Segmented } from '../../ui/Segmented'
import { BuilderEditor } from './BuilderEditor'
import { openDoc, type OpenDoc } from './load'
import { SessionBuilderPage } from './SessionBuilder'

type Sport = 'bike' | 'run' | 'swim'
const SPORTS = [
  { value: 'bike' as const, label: 'Bike', hint: 'A trainer workout, in % of FTP' },
  { value: 'run' as const, label: 'Run', hint: 'A run, by heart rate or pace' },
  { value: 'swim' as const, label: 'Swim', hint: 'A swim, by pace or % of CSS' },
]

/** Bike, run or swim. Leaving a builder with changes asks first, as any navigation does. */
function SportSwitch({ value }: { value: Sport }) {
  const navigate = useNavigate()
  return <Segmented ariaLabel="Sport" value={value} options={SPORTS} onChange={(s) => void navigate({ to: '/builder', search: s === 'bike' ? {} : { sport: s } })} className="mb-4" />
}

/** /builder: a bike workout (?id=… to open one), or with ?sport=run|swim a run or swim (&session=… to open one). */
export function BuilderPage() {
  const { id, sport, session } = useSearch({ from: '/builder' })
  if (sport) return <SessionBuilderPage key={sport} sport={sport} session={session} sportSwitch={<SportSwitch value={sport} />} />
  return <BikeBuilderPage id={id} />
}

/**
 * Opens the bike workout for the URL (a new one without an id; a copy for a
 * read-only built-in) in a fresh editor.
 */
function BikeBuilderPage({ id }: { id: string | undefined }) {
  const [doc, setDoc] = useState<OpenDoc | null>(null)
  // The stored workout the editor has open. A save updates the URL to its id,
  // and that must not reopen it (which would drop the undo history).
  const openId = useRef<string | null>(null)

  useEffect(() => {
    if (id !== undefined && id === openId.current) return
    let live = true
    void openDoc(id).then((d) => {
      if (!live) return
      openId.current = d.stored ? d.workout.id : null
      setDoc(d)
    })
    return () => {
      live = false
    }
  }, [id])

  if (!doc) {
    return (
      <div className="mx-auto max-w-7xl px-4 md:px-8 pb-12">
        <PageHeader title="Workout builder" subtitle="Opening…" />
      </div>
    )
  }
  return (
    <BuilderEditor
      key={doc.key}
      doc={doc}
      urlId={id}
      sportSwitch={<SportSwitch value="bike" />}
      onSaved={(savedId) => {
        openId.current = savedId
      }}
    />
  )
}
