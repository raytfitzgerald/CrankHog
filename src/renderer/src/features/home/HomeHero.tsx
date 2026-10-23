import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Play } from 'lucide-react'
import { previewLine } from '@core/coach'
import { heroWords } from '@core/home/hero'
import { rivalTaunt } from '@core/home/rival'
import { HOG, TRACK_QUIPS, hogLine } from '@core/mascot/hog'
import type { RideSummary } from '@core/ride/types'
import type { Workout } from '@core/workout/model'
import { HogHead } from '../../brand/hog/HogHead'
import { CoachHead, RiderHead } from '../../coach/heads'
import { riderInitials, useRider } from '../../db/rider'
import { useCoachPack } from '../../coach/custom'
import { useSettings } from '../../stores/settings'
import { Button } from '../../ui/Button'
import { HOG_LANE, HOG_LAP_S, HOG_SCALE, weekRiders } from './track'
import { Velodrome } from './Velodrome'

/**
 * The top of Home: the velodrome with this week's rides lapping it, a
 * headline that reads your form, a line from your coach, and the two things
 * you came for: ride now, or ride what's suggested.
 */
export function HomeHero({
  rides,
  tsb,
  now,
  suggested,
  reason,
}: {
  rides: readonly RideSummary[]
  tsb: number | null
  now: number
  suggested: Workout | null
  reason: string | null
}) {
  const coach = useSettings((s) => s.coach)
  const persona = useCoachPack(coach.personaId)
  const riders = useMemo(() => weekRiders(rides, now), [rides, now])
  const rider = useRider()
  const words = heroWords({ now: new Date(now), ridesThisWeek: riders.length, ridesEver: rides.filter((r) => !r.simulated).length, tsb })
  const first = rider.name?.split(/\s+/)[0] ?? null
  // Sir Loin is up on the stayers' line every week; on a week with no rides of
  // your own he has the place to himself, and your coach yells at him (and you)
  const [hogLabel] = useState(() => hogLine(TRACK_QUIPS))
  const hog = { id: HOG.id, label: riders.length === 0 ? `${HOG.name}, doing laps while you don't` : hogLabel, lapS: HOG_LAP_S, lane: HOG_LANE, scale: HOG_SCALE, head: <HogHead /> }
  // a fresh line on every visit, from whoever the rider picked
  const [line] = useState(() => (coach.enabled ? previewLine(persona, { spice: coach.spice, profanity: coach.profanity, trigger: 'ride_start', rideKinds: ['workout'], withoutFacts: ['workoutName'] }) : null))
  const [taunt] = useState(() => rivalTaunt(persona.meta.id))
  const said = coach.enabled && riders.length === 0 ? taunt : line?.text

  return (
    <section className="mb-6 grid grid-cols-[minmax(0,1fr)] items-center gap-6 overflow-hidden rounded-3xl border border-line bg-panel p-5 md:p-6 lg:grid-cols-[1.05fr_1fr] lg:p-8" data-testid="home-hero" aria-label="This week">
      <div className="min-w-0">
        <div className="eyebrow text-ink-faint">
          {words.eyebrow}
          {first && `, ${first}`}
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl leading-tight lg:text-5xl" data-testid="hero-title">
          {words.title}
        </h1>
        <p className="mt-2 max-w-md text-ink-dim">{words.sub}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild variant="primary" size="lg">
            <Link to="/ride" data-testid="hero-ride">
              <Play className="size-4 fill-current" /> Start riding
            </Link>
          </Button>
          {suggested && (
            <Button asChild variant="secondary" size="lg">
              <Link to="/workouts" search={{ open: suggested.id }} title={reason ?? undefined} data-testid="hero-suggested">
                <span className="eyebrow text-ink-faint">Suggested</span> {suggested.name} <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>
        {suggested && reason && <p className="mt-2 max-w-md text-xs text-ink-faint">{reason}</p>}
      </div>
      <div className="mx-auto flex w-full max-w-xl flex-col items-center">
        {/* the coach, in the infield, shouting at you to get on the bike: the bubble sits above the track, so nothing on the boards is hidden */}
        {said && (
          <figure className="relative mb-2 w-max max-w-full" data-testid="hero-coach">
            <blockquote className="rounded-2xl border border-line-strong bg-panel-2 px-3.5 py-2 text-sm font-semibold leading-snug shadow-lg">
              {said}
              <figcaption className="mt-1 text-xs font-normal text-ink-faint">{persona.meta.name}</figcaption>
            </blockquote>
            {/* the tail, pointing down at the coach */}
            <span className="absolute -bottom-[7px] left-1/2 size-3.5 -translate-x-1/2 rotate-45 border-b border-r border-line-strong bg-panel-2" aria-hidden />
          </figure>
        )}
        <Velodrome riders={riders} hog={hog} head={<RiderHead photo={rider.photo} initials={riderInitials(rider.name)} />} coach={coach.enabled ? <CoachHead personaId={persona.meta.id} /> : undefined} className="w-full" />
      </div>
    </section>
  )
}
