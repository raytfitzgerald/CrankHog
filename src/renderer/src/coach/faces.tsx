import type { ReactNode } from 'react'
import { avatarColors } from './avatar'
import type { FACE_IDS } from './face-ids'

// Cartoon faces for the coaches drawn as characters (Bibi and The Donald have
// photo caricatures instead). Each is a few strokes on the persona's own
// colour, drawn round (0, 0) on a head of radius 12, so the same face works
// as an avatar, on the ride-along bike and standing in the velodrome.
// Heads are the persona's hue, not a skin tone: they're characters.

const ink = (c: string) => ({ stroke: c, strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' })

type Draw = (c: string, bg: string) => ReactNode

const FACES: Record<(typeof FACE_IDS)[number], Draw> = {
  // campaign hat, a scowl and a mouth mid-bellow
  'drill-sergeant': (c) => (
    <>
      <ellipse cx={0} cy={-8.2} rx={13.5} ry={2.6} fill={c} />
      <path d="M-6.5 -8.5 L-4 -15 L0 -13 L4 -15 L6.5 -8.5 Z" fill={c} />
      <path d="M-7 -2.8 L-2.2 -1.4 M7 -2.8 L2.2 -1.4" {...ink(c)} strokeWidth={1.8} />
      <circle cx={-3.8} cy={0.6} r={1.1} fill={c} />
      <circle cx={3.8} cy={0.6} r={1.1} fill={c} />
      <rect x={-3.2} y={4} width={6.4} height={4.2} rx={1.6} fill={c} />
    </>
  ),
  // one eyebrow up, a smirk, and a bow tie peeking in
  'roast-comic': (c) => (
    <>
      <path d="M-7 -3.6 Q-4.5 -5.6 -2 -3.8 M2.2 -2.8 L6.8 -3" {...ink(c)} />
      <circle cx={-4.2} cy={-0.6} r={1.1} fill={c} />
      <circle cx={4.2} cy={-0.6} r={1.1} fill={c} />
      <path d="M-4.2 5 Q0.5 6.4 5 3.2" {...ink(c)} strokeWidth={1.6} />
      <path d="M-3 10.4 L0 11.6 L3 10.4 L3 13 L0 11.8 L-3 13 Z" fill={c} />
    </>
  ),
  // glasses, a moustache, and the long-suffering frown
  'disappointed-dad': (c) => (
    <>
      <path d="M-7.2 -4.4 L-2.4 -3.4 M7.2 -4.4 L2.4 -3.4" {...ink(c)} />
      <circle cx={-4.2} cy={-0.4} r={2.8} {...ink(c)} />
      <circle cx={4.2} cy={-0.4} r={2.8} {...ink(c)} />
      <path d="M-1.4 -0.6 L1.4 -0.6" {...ink(c)} />
      <path d="M-5 4.2 Q-2.5 2.8 0 4 Q2.5 2.8 5 4.2 Q2.5 5.6 0 4.9 Q-2.5 5.6 -5 4.2 Z" fill={c} />
      <path d="M-3.4 8.4 Q0 6.8 3.4 8.4" {...ink(c)} />
    </>
  ),
  // a crown, slit eyes and a very pleased grin
  'the-overlord': (c) => (
    <>
      <path d="M-8 -8 L-8 -14.5 L-4 -10.8 L0 -15.5 L4 -10.8 L8 -14.5 L8 -8 Z" fill={c} />
      <path d="M-7 -1 L-2 0.4 M7 -1 L2 0.4" {...ink(c)} strokeWidth={2} />
      <path d="M-6 4 Q0 9.6 6 4 Q0 6.6 -6 4 Z" fill={c} />
    </>
  ),
  // sweatband, raised brows, the biggest smile in the building
  'hype-coach': (c, bg) => (
    <>
      <rect x={-12} y={-8.6} width={24} height={3.6} rx={1.4} fill={c} />
      <path d="M-6.8 -2.6 Q-4.4 -4.2 -2 -2.6 M2 -2.6 Q4.4 -4.2 6.8 -2.6" {...ink(bg)} strokeWidth={1.2} />
      <path d="M-6.4 -1.6 Q-4.4 -3.6 -2.4 -1.6 M2.4 -1.6 Q4.4 -3.6 6.4 -1.6" {...ink(c)} strokeWidth={1.6} />
      <path d="M-6.4 3 Q0 11.4 6.4 3 Z" fill={c} />
    </>
  ),
  // square specs, a neat side parting and a small, satisfied smile
  'data-nerd': (c) => (
    <>
      <path d="M-9 -7 Q-2 -12 8 -8" {...ink(c)} strokeWidth={1.8} />
      <rect x={-7.4} y={-3.2} width={5.8} height={4.6} rx={0.8} {...ink(c)} />
      <rect x={1.6} y={-3.2} width={5.8} height={4.6} rx={0.8} {...ink(c)} />
      <path d="M-1.6 -1.2 L1.6 -1.2" {...ink(c)} />
      <circle cx={-4.5} cy={-0.9} r={0.9} fill={c} />
      <circle cx={4.5} cy={-0.9} r={0.9} fill={c} />
      <path d="M-2.6 5.4 Q0 7.2 2.6 5.4" {...ink(c)} />
    </>
  ),
  // eyes closed, entirely at peace with your suffering
  zen: (c) => (
    <>
      <path d="M-6.6 0 Q-4.4 2 -2.2 0 M2.2 0 Q4.4 2 6.6 0" {...ink(c)} strokeWidth={1.6} />
      <path d="M-3.2 5 Q0 7.4 3.2 5" {...ink(c)} />
      <path d="M-9.4 3.2 L-8 3.2 M8 3.2 L9.4 3.2" {...ink(c)} opacity={0.6} />
    </>
  ),
  // round cheeks, two chins, a sweat drop and a grin that says he's still not getting up
  'fat-guy': (c) => (
    <>
      <circle cx={-4} cy={-2} r={1.1} fill={c} />
      <circle cx={4} cy={-2} r={1.1} fill={c} />
      <path d="M-9.2 0.8 Q-7.6 3.2 -6 0.8 M6 0.8 Q7.6 3.2 9.2 0.8" {...ink(c)} opacity={0.7} />
      <path d="M-4.2 2.8 Q0 7.6 4.2 2.8 Z" fill={c} />
      <path d="M-6.4 8.6 Q0 12 6.4 8.6 M-4 10.6 Q0 12.6 4 10.6" {...ink(c)} />
      <path d="M8.8 -8.4 Q10.6 -5.8 8.8 -4.6 Q7 -5.8 8.8 -8.4 Z" fill={c} opacity={0.8} />
    </>
  ),
  // the swamp: trumpet ears, one heavy brow and a snaggle tooth
  shrek: (c, bg) => (
    <>
      <path d="M-7.4 -8.8 L-10.6 -11.8 M7.4 -8.8 L10.6 -11.8" {...ink(c)} strokeWidth={2.6} />
      <circle cx={-11.4} cy={-12.6} r={1.9} fill={c} />
      <circle cx={11.4} cy={-12.6} r={1.9} fill={c} />
      <circle cx={-11.6} cy={-12.8} r={0.8} fill={bg} />
      <circle cx={11.6} cy={-12.8} r={0.8} fill={bg} />
      <path d="M-7.6 -3.2 Q-4.6 -5.2 -1.4 -2.8 M1.4 -2.8 Q4.6 -5.2 7.6 -3.2" {...ink(c)} strokeWidth={2} />
      <circle cx={-4.2} cy={-0.6} r={1.1} fill={c} />
      <circle cx={4.2} cy={-0.6} r={1.1} fill={c} />
      <path d="M-5 6.4 Q0 3.6 5 6.4 L5 7.4 Q0 5 -5 7.4 Z" fill={c} />
      <path d="M-2.2 5.2 L-1.5 6.9 L-0.8 5.1 Z" fill={bg} />
    </>
  ),
  // no face at all, and a tie
  'slender-man': (c) => (
    <>
      <path d="M-4.4 10.4 L0 12.8 L4.4 10.4" {...ink(c)} />
      <path d="M0 12.8 L-1 15 L0 16 L1 15 Z" fill={c} />
    </>
  ),
  // mismatched eyes, a tuft of spikes and a mouth that never stops screaming
  'the-thing': (c, bg) => (
    <>
      <path d="M-7 -9.6 L-5.6 -14.2 L-3.4 -10.4 L-1 -15 L1.2 -10.4 L3.6 -14.4 L5.6 -10 Z" fill={c} />
      <circle cx={-4.4} cy={-2.6} r={2.7} {...ink(c)} />
      <circle cx={-4.4} cy={-2.2} r={1.1} fill={c} />
      <circle cx={4.6} cy={-3.2} r={1.7} {...ink(c)} />
      <circle cx={4.9} cy={-3} r={0.7} fill={c} />
      <path d="M-6.2 2 Q0 13 6.2 2 Z" fill={c} />
      <path d="M-5.2 2.4 L-4.2 4.4 L-3.2 2.6 L-2.1 4.7 L-1 2.8 L0 4.9 L1 2.8 L2.1 4.7 L3.2 2.6 L4.2 4.4 L5.2 2.4 Z" fill={bg} />
    </>
  ),
  // the side parting, the networking smile and an open collar
  'linkedin-guy': (c) => (
    <>
      <path d="M-10.6 -3.8 Q-9.6 -12.6 1 -12 Q9.8 -11.2 10.6 -3.8 Q5 -9.8 -1.4 -8.2 Q-7 -7.6 -10.6 -3.8 Z" fill={c} />
      <path d="M-6.6 -3.4 Q-4.4 -4.8 -2.2 -3.4 M2.2 -3.4 Q4.4 -4.8 6.6 -3.4" {...ink(c)} />
      <circle cx={-4.4} cy={-0.6} r={1.1} fill={c} />
      <circle cx={4.4} cy={-0.6} r={1.1} fill={c} />
      <path d="M-4.6 3.4 Q0 8.2 4.6 3.4 Z" fill={c} />
      <path d="M-5.8 10 L-2 12.6 L0 10.8 L2 12.6 L5.8 10" {...ink(c)} />
    </>
  ),
  // headset mic, eyebrows to the ceiling, the biggest grin money can buy
  'infomercial-host': (c) => (
    <>
      <path d="M-11.2 -1.6 Q-12.4 -13.6 0 -13.8 Q12.4 -13.6 11.2 -1.6" {...ink(c)} />
      <rect x={-13} y={-3.6} width={2.6} height={4.6} rx={1} fill={c} />
      <path d="M-11.4 1 Q-10 6.4 -5.2 6.6" {...ink(c)} />
      <circle cx={-4.6} cy={6.6} r={1.2} fill={c} />
      <path d="M-6.8 -5 Q-4.4 -7 -2 -5 M2 -5 Q4.4 -7 6.8 -5" {...ink(c)} />
      <circle cx={-4.2} cy={-1.4} r={1.4} fill={c} />
      <circle cx={4.2} cy={-1.4} r={1.4} fill={c} />
      <path d="M-3.6 2.4 Q1.2 10.4 6 2.4 Z" fill={c} />
    </>
  ),
  // safari hat, half-closed eyes, speaking very, very quietly
  'nature-narrator': (c, bg) => (
    <>
      <ellipse cx={0} cy={-8} rx={13.4} ry={2.4} fill={c} />
      <path d="M-7 -8.6 Q-6.6 -14.8 0 -15 Q6.6 -14.8 7 -8.6 Z" fill={c} />
      <path d="M-7 -9.8 L7 -9.8" {...ink(bg)} strokeWidth={1.1} />
      <path d="M-6.4 -0.2 Q-4.4 -1.8 -2.4 -0.2 M2.4 -0.2 Q4.4 -1.8 6.4 -0.2" {...ink(c)} strokeWidth={1.6} />
      <circle cx={0} cy={5.6} r={1.2} {...ink(c)} />
    </>
  ),
  // bucket hat, eyes at half-mast, deeply unimpressed
  'gen-z-intern': (c) => (
    <>
      <path d="M-10.8 -6 Q-9.6 -14.4 0 -14.4 Q9.6 -14.4 10.8 -6 Z" fill={c} />
      <path d="M-13.6 -5.8 L13.6 -5.8" {...ink(c)} strokeWidth={2} />
      <path d="M-6.6 -0.8 L-2.2 -0.8 M2.2 -0.8 L6.6 -0.8" {...ink(c)} strokeWidth={1.8} />
      <circle cx={-4.4} cy={0.4} r={0.9} fill={c} />
      <circle cx={4.4} cy={0.4} r={0.9} fill={c} />
      <path d="M-2.6 5.8 Q0.6 6.8 3.8 4.6" {...ink(c)} />
    </>
  ),
  // tidy hair, level gaze, a straight line of a mouth
  professional: (c) => (
    <>
      <path d="M-10.4 -4.4 Q-9 -12 0 -11.8 Q9 -12 10.4 -4.4 Q6 -9 -2 -8.6 Q-7 -8.4 -10.4 -4.4 Z" fill={c} />
      <circle cx={-4} cy={-0.4} r={1.1} fill={c} />
      <circle cx={4} cy={-0.4} r={1.1} fill={c} />
      <path d="M-3.2 5 L3.2 5" {...ink(c)} />
    </>
  ),
}

/** A coach's face, drawn round (0, 0) at radius 12. Null for personas without one. */
export function CoachFace({ personaId }: { personaId: string }) {
  const draw = (FACES as Partial<Record<string, Draw>>)[personaId]
  if (!draw) return null
  const { background, color } = avatarColors(personaId)
  return (
    <g data-face={personaId}>
      <circle r={12} fill={background} />
      {draw(color, background)}
    </g>
  )
}
