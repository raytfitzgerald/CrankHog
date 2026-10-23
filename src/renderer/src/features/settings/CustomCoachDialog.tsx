import { useRef, useState } from 'react'
import { ImagePlus, Plus, Sparkles, Trash2, X } from 'lucide-react'
import {
  MAX_COACH_NAME,
  MAX_PERSONA_CHARS,
  MAX_PHRASES,
  coachNameProblem,
  newCustomCoachId,
  phraseProblem,
  type CustomCoach,
  type PhraseMoment,
} from '@core/coach'
import { MAX_LINE_CHARS } from '@core/persona'
import { avatarColors, monogram } from '../../coach/avatar'
import { customCoach, deleteCustomCoach, saveCustomCoach, useCustomCoach, useLinesStatus, writeCoachLines } from '../../coach/custom'
import { photoFromFile } from '../../db/rider'
import { isNative } from '../../platform/native'
import { patchSettings, settingsStore } from '../../stores/settings'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Input, Select } from '../../ui/form'

const MOMENTS: { value: PhraseMoment; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'start', label: 'Ride start' },
  { value: 'hard', label: 'Hard efforts' },
  { value: 'struggling', label: 'When I fade' },
  { value: 'done', label: 'When I nail it' },
]

const area =
  'no-drag w-full resize-y rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none'

interface Row {
  key: number
  text: string
  moment: PhraseMoment
}

/**
 * Makes or edits a custom coach: a photo, a name, who they are, and lines of
 * the rider's own. Saving a new coach makes it the rider's coach; with an AI
 * set up, the AI then writes their lines in the background.
 */
export function CustomCoachDialog({ coach, ai, open, onOpenChange }: { coach: CustomCoach | null; ai: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={coach ? `Edit ${coach.name}` : 'Make your own coach'}
      description="A name, a face and a personality. Your own lines are optional."
      className="max-h-[calc(100dvh-32px)] w-[min(640px,calc(100vw-32px))] overflow-y-auto"
    >
      {/* keyed so reopening starts from the saved coach, not a half-edited draft */}
      {open && <Editor key={coach?.id ?? 'new'} coach={coach} ai={ai} close={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function Editor({ coach, ai, close }: { coach: CustomCoach | null; ai: boolean; close: () => void }) {
  const [name, setName] = useState(coach?.name ?? '')
  const [photo, setPhoto] = useState<string | null>(coach?.photo ?? null)
  const [persona, setPersona] = useState(coach?.persona ?? '')
  const [rows, setRows] = useState<Row[]>(() => (coach?.phrases ?? []).map((p, i) => ({ key: i, text: p.text, moment: p.moment })))
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const status = useLinesStatus(coach?.id ?? '')
  // the AI may finish writing while this is open: show and keep its lines, not the ones from when it opened
  const aiLines = useCustomCoach(coach?.id ?? '')?.aiLines ?? coach?.aiLines ?? []

  const filled = rows.filter((r) => r.text.trim())
  const nameProblem = coachNameProblem(name)
  const rowProblem = (r: Row) => (r.text.trim() ? phraseProblem(r.text) : null)
  const empty = !persona.trim() && filled.length === 0
  const canSave = !saving && nameProblem === null && !empty && filled.every((r) => rowProblem(r) === null)

  const choose = async (f: File | undefined) => {
    setPhotoError(null)
    if (!f) return
    try {
      setPhoto(await photoFromFile(f))
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : String(e))
    }
  }
  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    const now = Date.now()
    const next: CustomCoach = {
      id: coach?.id ?? newCustomCoachId(Math.random),
      name: name.trim(),
      photo,
      persona: persona.trim(),
      phrases: filled.map((r) => ({ text: r.text.replace(/\s+/g, ' ').trim(), moment: r.moment })),
      // kept until the AI has written new ones, so the coach is never left with nothing to say
      aiLines: (coach && customCoach(coach.id)?.aiLines) ?? [],
      createdAt: coach?.createdAt ?? now,
      updatedAt: now,
    }
    try {
      await saveCustomCoach(next)
      const prefs = settingsStore.getState().coach
      if (!coach) await patchSettings({ coach: { ...prefs, personaId: next.id } })
      if (ai && next.persona && (next.persona !== coach?.persona || next.aiLines.length === 0)) void writeCoachLines(next.id, { spice: prefs.spice, profanity: prefs.profanity })
      close()
    } finally {
      setSaving(false)
    }
  }

  const rewrite = () => {
    if (!coach) return
    const prefs = settingsStore.getState().coach
    void writeCoachLines(coach.id, { spice: prefs.spice, profanity: prefs.profanity })
  }

  return (
    <div className="space-y-5" data-testid="custom-coach-editor">
      <div className="flex items-center gap-4">
        <div
          className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full font-display text-xl font-semibold"
          style={photo ? undefined : avatarColors(coach?.id ?? 'custom-new')}
          data-testid="custom-coach-photo"
        >
          {photo ? <img src={photo} alt="Coach photo" className="size-full object-cover" /> : monogram(name.trim() || '?')}
        </div>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => void choose(e.target.files?.[0]).finally(() => (e.target.value = ''))} data-testid="custom-coach-photo-input" />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => file.current?.click()}>
            <ImagePlus className="size-3.5" /> {photo ? 'Change photo' : 'Add a photo'}
          </Button>
          {photo && (
            <Button size="sm" variant="ghost" onClick={() => setPhoto(null)}>
              Remove
            </Button>
          )}
        </div>
      </div>
      {photoError && <p className="-mt-3 text-sm text-bad">{photoError}</p>}

      <label className="block text-sm font-medium">
        Name
        <Input className="mt-1" value={name} maxLength={MAX_COACH_NAME} onChange={(e) => setName(e.target.value)} placeholder="Uncle Rog" data-testid="custom-coach-name" />
        {name.trim() && nameProblem && <span className="mt-1 block text-xs font-normal text-bad">{nameProblem}</span>}
      </label>

      <label className="block text-sm font-medium">
        Who they are
        <textarea
          className={`${area} mt-1 h-28`}
          value={persona}
          maxLength={MAX_PERSONA_CHARS}
          onChange={(e) => setPersona(e.target.value)}
          placeholder="A retired pro from Yorkshire. Dry, blunt, never impressed out loud, secretly proud of me. Talks about suffering like it's the weather."
          data-testid="custom-coach-persona"
        />
        <span className="mt-1 block text-xs font-normal text-ink-faint">
          {ai
            ? 'Your AI writes their ride lines from this, and plays them in the Coach chat, debriefs and fresh lines.'
            : isNative()
              ? 'In the Mac app with an AI provider set up, the AI writes their ride lines from this and chats as them.'
              : 'Set up an AI provider (Settings → AI) and the AI writes their ride lines from this and chats as them.'}{' '}
          They still never joke about your body, weight or health.
        </span>
      </label>

      <div>
        <div className="text-sm font-medium">
          Their lines <span className="font-normal text-ink-faint">(optional)</span>
        </div>
        <p className="mt-0.5 text-xs text-ink-faint">Said during rides, at the moment you pick. Placeholders like {'{power}'} or {'{remainingS}'} are filled in. Swearing follows your Profanity setting.</p>
        <ul className="mt-2 space-y-2">
          {rows.map((r) => {
            const problem = rowProblem(r)
            return (
              <li key={r.key} data-testid="custom-coach-line">
                <div className="flex items-center gap-2">
                  <Input
                    className="h-9 min-w-0 flex-1"
                    value={r.text}
                    maxLength={MAX_LINE_CHARS}
                    onChange={(e) => setRow(r.key, { text: e.target.value })}
                    placeholder="Right then. Legs on."
                    aria-label="Line"
                    aria-invalid={problem !== null}
                  />
                  <Select className="h-9 w-36 shrink-0" value={r.moment} onChange={(e) => setRow(r.key, { moment: e.target.value as PhraseMoment })} aria-label="When">
                    {MOMENTS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                  <Button size="iconSm" variant="ghost" aria-label="Remove this line" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                    <X className="size-4" />
                  </Button>
                </div>
                {problem && <p className="mt-1 text-xs text-bad">{problem}</p>}
              </li>
            )
          })}
        </ul>
        {rows.length < MAX_PHRASES && (
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setRows((rs) => [...rs, { key: Math.max(-1, ...rs.map((r) => r.key)) + 1, text: '', moment: 'any' }])} data-testid="custom-coach-add-line">
            <Plus className="size-3.5" /> Add a line
          </Button>
        )}
      </div>

      {coach && (aiLines.length > 0 || status !== null || (ai && coach.persona)) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm" data-testid="custom-coach-ai-lines">
          <Sparkles className="size-4 shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1 text-ink-dim">
            {status === 'writing'
              ? 'Your AI is writing their lines…'
              : status === 'failed'
                ? 'The AI couldn’t write lines just now. Their own lines and the plain cues still work.'
                : aiLines.length > 0
                  ? `${aiLines.length} lines written by your AI from the description.`
                  : 'No AI lines yet.'}
          </span>
          {ai && coach.persona && status !== 'writing' && (
            <Button size="sm" onClick={rewrite}>
              Write new lines
            </Button>
          )}
        </div>
      )}

      {empty && <p className="text-xs text-ink-faint">Describe who they are or give them a line, so they have something to say.</p>}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {coach &&
          (confirmDelete ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                close()
                void deleteCustomCoach(coach.id)
              }}
              data-testid="custom-coach-delete-confirm"
            >
              <Trash2 className="size-3.5" /> Delete {coach.name} for good
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-3.5" /> Delete coach
            </Button>
          ))}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canSave} onClick={() => void save()} data-testid="custom-coach-save">
            {coach ? 'Save' : 'Save and pick'}
          </Button>
        </div>
      </div>
    </div>
  )
}
