// Sir Loin, doing whichever stunt the road has asked for.
//
// The ones on a bike reuse the ride-along Cyclist with his head on it, under a
// transform: a wheelie is the whole bike rotated about the rear hub, a tuck is
// a lean and a squash. That keeps one bike in the codebase instead of six.
//
// The roadside ones are drawn here, over a shared body, because he isn't on a
// bike for those. They are small on screen, so they are silhouette and one
// prop each — detail past that is wasted at 50 px.

import { STUNTS, type HogStunt } from '@core/mascot/stunts'
import { Cyclist } from '../../coach/ride-along/Cyclist'
import { cn } from '../../ui/cn'
import { HogHead } from './HogHead'

const INK = 'var(--color-night)'
const HIDE = 'var(--color-hog)'
const SHADE = 'var(--color-hog-shade)'
const VIEW = { w: 128, h: 76 }
const GROUND = 64

/** How each bike stunt sits on the road: a class for the motion, a transform for the pose. */
const BIKE_POSE: Partial<Record<HogStunt, { className?: string; style?: React.CSSProperties }>> = {
  wheelie: { style: { transform: 'rotate(-20deg)', transformOrigin: '22% 84%' } },
  tuck: { style: { transform: 'rotate(2.5deg) scaleY(0.9)', transformOrigin: '50% 100%' } },
  sprint: { className: 'animate-[hog-rock_0.28s_ease-in-out_infinite]' },
  grind: { className: 'animate-[hog-rock_0.95s_ease-in-out_infinite]' },
  draft: { style: { transform: 'scale(0.94)' } },
}

export function HogRider({ stunt, height, label }: { stunt: HogStunt; height: number; label: string }) {
  const spec = STUNTS[stunt]
  if (spec.kind === 'passing') {
    const pose = BIKE_POSE[stunt]
    // 0 rpm coasts, which is exactly what a tuck is
    const cadence = () => spec.rpm
    return (
      <div className={cn('origin-bottom', pose?.className)} style={pose?.style}>
        <Cyclist jersey={HIDE} cadence={cadence} height={height} label={label} head={<HogHead />} />
      </div>
    )
  }
  return <Roadside stunt={stunt} height={height} label={label} />
}

/** Four legs straight down: the base every standing pose starts from. */
const STAND = [
  'M33 38 L30 64',
  'M65 37 L69 64',
  'M37 39 L34 64',
  'M69 38 L73 64',
] as const

const TAIL = 'M26 28 q-7 -4 -9 1 q-2 5 3 5 q4 0 3 -4'

function Leg({ d, far = false }: { d: string; far?: boolean }) {
  return <path d={d} fill="none" stroke={far ? SHADE : HIDE} strokeWidth={far ? 6 : 7} strokeLinecap="round" strokeLinejoin="round" />
}

function Roadside({ stunt, height, label }: { stunt: HogStunt; height: number; label: string }) {
  const width = (height * VIEW.w) / VIEW.h
  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} width={width} height={height} role="img" aria-label={label} className="overflow-visible">
      {stunt === 'tumble' ? <Tumble /> : stunt === 'nap' ? <Nap /> : stunt === 'picnic' ? <Picnic /> : <Standing stunt={stunt} />}
    </svg>
  )
}

/** Sign and cheer: on his feet, with something in a front trotter. */
function Standing({ stunt }: { stunt: HogStunt }) {
  const cheering = stunt === 'cheer'
  return (
    <g>
      <Leg d={STAND[0]} far />
      <Leg d={STAND[1]} far />
      <path d={TAIL} fill="none" stroke={HIDE} strokeWidth={3.4} strokeLinecap="round" transform="translate(4 -4)" />
      <ellipse cx={50} cy={28} rx={25} ry={15} fill={HIDE} stroke={INK} strokeWidth={2.4} />
      <Leg d={STAND[2]} />
      {/* the near front trotter goes up, to the sign or the cowbell */}
      <Leg d={cheering ? 'M69 38 Q82 34 88 20' : 'M69 38 Q84 36 90 24'} />
      <g transform="translate(80 21) scale(1.45)">
        <HogHead />
      </g>
      {cheering ? (
        <g className="origin-[92px_18px] animate-[hog-ring_0.4s_ease-in-out_infinite]">
          {/* a cowbell */}
          <path d="M88 14 Q92 12 96 14 L98 24 H86 Z" fill="var(--color-tusk)" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <circle cx={92} cy={26} r={2} fill={INK} />
        </g>
      ) : (
        <g>
          {/* a sign, with the writing suggested rather than set: it would be two pixels tall */}
          <path d="M92 26 L92 2" stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <rect x={72} y={-14} width={44} height={20} rx={3} fill="var(--color-board)" stroke={INK} strokeWidth={2.4} />
          <path d="M78 -8 H110 M78 -2 H100" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

/** Asleep on the verge, with the snoring made visible. */
function Nap() {
  return (
    <g>
      <path d={TAIL} fill="none" stroke={HIDE} strokeWidth={3.4} strokeLinecap="round" transform="translate(2 18)" />
      {/* tucked legs, barely showing under him */}
      <Leg d="M38 56 L36 64" far />
      <Leg d="M64 56 L67 64" far />
      <ellipse cx={52} cy={50} rx={26} ry={13} fill={HIDE} stroke={INK} strokeWidth={2.4} />
      <Leg d="M42 58 L40 64" />
      <Leg d="M68 58 L71 64" />
      {/* head down on the grass, ear over one eye */}
      <g transform="translate(84 48) scale(1.3) rotate(12)">
        <HogHead />
      </g>
      <g stroke={INK} fill="none" strokeWidth={2.2} strokeLinecap="round" className="animate-[hog-snore_2.4s_ease-in-out_infinite]">
        <path d="M74 28 h7 l-7 7 h7" />
        <path d="M86 16 h5 l-5 5 h5" />
      </g>
    </g>
  )
}

/** Sat on the verge with a sandwich, entirely at ease. */
function Picnic() {
  return (
    <g>
      <path d={TAIL} fill="none" stroke={HIDE} strokeWidth={3.4} strokeLinecap="round" transform="translate(-2 8)" />
      {/* sitting: haunches down, front legs propped */}
      <Leg d="M34 48 Q30 58 38 64" far />
      <Leg d="M62 44 L66 64" far />
      <ellipse cx={48} cy={42} rx={25} ry={16} fill={HIDE} stroke={INK} strokeWidth={2.4} transform="rotate(-11 48 42)" />
      <Leg d="M38 50 Q33 60 42 64" />
      {/* the near front trotter holds lunch up to the snout */}
      <Leg d="M66 46 Q78 44 84 36" />
      <g transform="translate(78 30) scale(1.4)">
        <HogHead />
      </g>
      {/* a sandwich */}
      <g transform="translate(90 32) rotate(-12)">
        <path d="M-7 -5 L7 -5 L7 5 L-7 5 Z" fill="var(--color-tusk)" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <path d="M-7 0 H7" stroke={INK} strokeWidth={1.8} />
      </g>
    </g>
  )
}

/** In the hedge, trotters up, entirely unbothered. */
function Tumble() {
  return (
    <g>
      <g transform="translate(66 34) rotate(168) translate(-52 -36)">
        <Leg d="M32 44 L29 62" far />
        <Leg d="M66 43 L70 62" far />
        <ellipse cx={50} cy={34} rx={24} ry={15} fill={HIDE} stroke={INK} strokeWidth={2.4} />
        <Leg d="M36 45 L32 63" />
        <Leg d="M70 44 L75 63" />
        <g transform="translate(80 27) scale(1.4)">
          <HogHead />
        </g>
      </g>
      {/* the hedge he is in, drawn over him */}
      <g fill="var(--color-line-strong)" stroke={INK} strokeWidth={2}>
        <ellipse cx={32} cy={64} rx={21} ry={12} />
        <ellipse cx={62} cy={66} rx={25} ry={13} />
        <ellipse cx={92} cy={64} rx={19} ry={11} />
      </g>
      <path d={`M4 ${GROUND + 8} H124`} stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.35} />
    </g>
  )
}
