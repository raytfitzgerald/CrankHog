import { useRef, useState, type DragEvent } from 'react'
import { CalendarPlus, FileUp } from 'lucide-react'
import { describeImport, importFitFiles } from '../../db/fit-import'
import { Button } from '../../ui/Button'
import { PageHeader } from '../../ui/PageHeader'
import { cn } from '../../ui/cn'
import { ActivitySync } from './ActivitySync'
import { GoogleCalendarLink } from './GoogleCalendarLink'
import { IntervalsImport } from './IntervalsImport'
import { MonthCalendar } from './MonthCalendar'
import { DayDialog, type DayMode } from './DayDialog'
import { importWorkoutFiles, SESSION_IMPORT_EXTENSIONS, type ImportLine } from '../../workouts/session-import'
import { FormatGuideLink } from '../sessions/FormatGuide'
import { ImportReport } from '../sessions/ImportReport'
import type { CalendarDay } from './calendar'

/** The training calendar: what is planned, what was done, and the volume of both. */
export function CalendarPage() {
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [day, setDay] = useState<{ day: CalendarDay; mode?: DayMode } | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const sessionInput = useRef<HTMLInputElement>(null)
  const [report, setReport] = useState<ImportLine[] | null>(null)

  /** Session and workout files: each goes on the day its name or "date:" line gives. */
  const importSessions = async (list: FileList | File[]) => {
    const files = await Promise.all(Array.from(list).filter((f) => SESSION_IMPORT_EXTENSIONS.some((x) => f.name.toLowerCase().endsWith(x))).map(async (f) => ({ name: f.name, text: await f.text() })))
    if (files.length === 0) return
    try {
      setNotice(null)
      setReport(await importWorkoutFiles(files, 'calendar'))
    } catch (e) {
      setNotice({ tone: 'bad', text: `Couldn't import: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  /** FIT files from a Garmin or other watch: rides go to History, runs, swims and strength sessions onto the calendar. */
  const importFiles = async (list: FileList | File[]) => {
    const files = await Promise.all(Array.from(list).filter((f) => /\.fit$/i.test(f.name)).map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })))
    if (files.length === 0) return
    try {
      const r = await importFitFiles(files, (done, total) => setBusy(`Importing ${done} of ${total}…`))
      setNotice({ tone: r.imported.length + r.activities.length > 0 ? 'good' : 'bad', text: `Imported ${describeImport(r)}${r.skipped.length ? `; skipped ${r.skipped.length} (${r.skipped[0]!.reason}${r.skipped.length > 1 ? '…' : ''})` : ''}.` })
    } catch (e) {
      setNotice({ tone: 'bad', text: `Couldn't import: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBusy(null)
    }
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    // .fit files are activities you did; .txt and the bike formats are sessions to plan
    void importFiles(e.dataTransfer.files)
    void importSessions(e.dataTransfer.files)
  }

  return (
    <div
      className={cn('mx-auto max-w-7xl px-4 md:px-8 pb-10', dragging && 'outline-2 outline-dashed outline-accent/60')}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <PageHeader
        title="Calendar"
        subtitle="Planned workouts, rides, runs, swims and everything else, a month at a time. Click a day to put a workout on it, plan a session, log an activity, or add an event or a day off. Drag a planned workout to move it."
        actions={
          <>
            {!__CRANKHOG_WEB__ && <GoogleCalendarLink onNotice={setNotice} />}
            <ActivitySync onNotice={setNotice} />
            <IntervalsImport onNotice={setNotice} />
            <input ref={input} type="file" accept=".fit" multiple className="hidden" onChange={(e) => e.target.files && void importFiles(e.target.files)} data-testid="activities-file" />
            <Button size="sm" disabled={!!busy} onClick={() => input.current?.click()} title="Runs, swims and strength sessions from your Garmin as .fit files (or drop them here)" data-testid="import-activities">
              <FileUp className="size-3.5" /> {busy ?? 'Import activities'}
            </Button>
            <input
              ref={sessionInput}
              type="file"
              accept={SESSION_IMPORT_EXTENSIONS.join(',')}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void importSessions(e.target.files)
                e.target.value = ''
              }}
              data-testid="sessions-file"
            />
            <Button size="sm" onClick={() => sessionInput.current?.click()} title="Planned runs, swims and other sessions as .txt files named YYYY-MM-DD_Name.txt (bike workouts too). See the Format guide." data-testid="import-sessions">
              <CalendarPlus className="size-3.5" /> Import sessions
            </Button>
            <FormatGuideLink />
          </>
        }
      />
      {notice && (
        <div className={cn('mb-4 rounded-xl border px-4 py-2 text-sm', notice.tone === 'good' ? 'border-good/40 bg-good/5' : 'border-bad/40 bg-bad/10')} role="status">
          {notice.text}
        </div>
      )}
      {report && <ImportReport lines={report} onDismiss={() => setReport(null)} />}
      <MonthCalendar onDay={(d, mode) => setDay({ day: d, mode })} />
      {day && <DayDialog day={day.day} mode={day.mode} onClose={() => setDay(null)} />}
    </div>
  )
}
